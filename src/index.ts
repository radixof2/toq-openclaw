import { connect } from "@toqprotocol/toq";
import { EventSource } from "eventsource";
import WebSocket from "ws";

const DEFAULT_API_URL = "http://127.0.0.1:9009";
const GATEWAY_WS_URL = "ws://127.0.0.1:18789";
export const CHANNEL_ID = "toq";
export const STREAM_CHUNK_TYPE = "message.stream.chunk";
export const STREAM_END_TYPE = "message.stream.end";

export const streamBuffers = new Map<string, { from: string; text: string; threadId?: string }>();

interface AccountState {
  localAddress: string;
  ws: WebSocket | null;
  wsReady: boolean;
  wsRequestId: number;
}

const accounts = new Map<string, AccountState>();

function getAccount(accountId: string): AccountState {
  let state = accounts.get(accountId);
  if (!state) {
    state = { localAddress: "", ws: null, wsReady: false, wsRequestId: 0 };
    accounts.set(accountId, state);
  }
  return state;
}

function connectGateway(accountId: string, log: any): Promise<void> {
  const state = getAccount(accountId);
  return new Promise((resolve) => {
    const ws = new WebSocket(GATEWAY_WS_URL);

    ws.on("open", () => {
      state.wsRequestId++;
      ws.send(JSON.stringify({
        jsonrpc: "2.0",
        id: state.wsRequestId,
        method: "connect",
        params: {
          role: "control",
          auth: {},
          client: { name: `toq-channel-${accountId}`, version: "0.1.0", platform: "plugin" },
        },
      }));
    });

    ws.on("message", (data: Buffer) => {
      try {
        const frame = JSON.parse(data.toString());
        if (frame.id && frame.ok && !state.wsReady) {
          log.info?.(`[toq:${accountId}] gateway WebSocket connected`);
          state.ws = ws;
          state.wsReady = true;
          resolve();
        }
      } catch {}
    });

    ws.on("close", () => {
      state.wsReady = false;
      state.ws = null;
      log.warn?.(`[toq:${accountId}] gateway WebSocket closed, reconnecting in 5s`);
      setTimeout(() => connectGateway(accountId, log), 5000);
    });

    ws.on("error", (err) => {
      log.error?.(`[toq:${accountId}] gateway WebSocket error: ${err.message}`);
      resolve();
    });
  });
}

function sendToAgent(accountId: string, from: string, text: string, threadId?: string): void {
  const state = getAccount(accountId);
  if (!state.ws || !state.wsReady) return;

  const meta = threadId ? ` (thread: ${threadId})` : "";
  const message = `[toq] Message from ${from}${meta}:\n\n${text}`;

  state.wsRequestId++;
  state.ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id: state.wsRequestId,
    method: "agent",
    params: { message },
  }));
}

export function handleMessage(accountId: string, msg: any): void {
  const state = getAccount(accountId);
  if (state.localAddress && msg.from?.includes(state.localAddress)) return;

  const body = msg.body as Record<string, unknown> | undefined;

  if (msg.type === STREAM_CHUNK_TYPE) {
    const streamId = body?.stream_id as string;
    if (!streamId) return;
    const buf = streamBuffers.get(streamId) ?? { from: msg.from, text: "", threadId: msg.thread_id };
    buf.text += (body?.data as any)?.text ?? "";
    streamBuffers.set(streamId, buf);
    return;
  }

  if (msg.type === STREAM_END_TYPE) {
    const streamId = body?.stream_id as string;
    if (!streamId) return;
    const buf = streamBuffers.get(streamId);
    streamBuffers.delete(streamId);
    const finalChunk = (body?.data as any)?.text ?? "";
    const fullText = (buf?.text ?? "") + finalChunk;
    if (fullText) {
      sendToAgent(accountId, buf?.from ?? msg.from, fullText, buf?.threadId);
    }
    return;
  }

  const text = body?.text as string;
  if (text && msg.type === "message.send") {
    sendToAgent(accountId, msg.from, text, msg.thread_id);
  }
}

export const toqChannel = {
  id: CHANNEL_ID,
  meta: {
    id: CHANNEL_ID,
    label: "toq protocol",
    selectionLabel: "toq protocol (agent-to-agent)",
    blurb: "Secure agent-to-agent communication via toq protocol",
    aliases: ["toq-protocol"],
  },
  capabilities: { chatTypes: ["direct"] as const },
  config: {
    listAccountIds: (cfg: any) => Object.keys(cfg.channels?.toq?.accounts ?? {}),
    resolveAccount: (cfg: any, id?: string) =>
      cfg.channels?.toq?.accounts?.[id ?? "default"] ?? { accountId: id ?? "default" },
  },
  setup: {
    applyAccountConfig: (ctx: any) => {
      const cfg = ctx.cfg;
      const accountId = ctx.accountId ?? "default";
      cfg.channels ??= {};
      cfg.channels.toq ??= {};
      cfg.channels.toq.accounts ??= {};
      cfg.channels.toq.accounts[accountId] = { ...cfg.channels.toq.accounts[accountId], enabled: true };
      return cfg;
    },
  },
  gateway: {
    startAccount: async (ctx: any) => {
      const accountId = ctx.accountId ?? "default";
      const apiUrl = ctx.account?.apiUrl ?? ctx.cfg?.channels?.toq?.apiUrl ?? DEFAULT_API_URL;
      const log = ctx.log ?? console;
      const state = getAccount(accountId);

      // Learn local address to filter outbound messages
      try {
        const client = connect(apiUrl);
        const status = await client.status() as any;
        state.localAddress = status?.address ?? "";
        log.info?.(`[toq:${accountId}] local address: ${state.localAddress}`);
      } catch {}

      // Connect to Gateway WebSocket for dispatching
      await connectGateway(accountId, log);

      // Connect to toq SSE for inbound messages
      const es = new EventSource(`${apiUrl}/v1/messages`);
      log.info?.(`[toq:${accountId}] SSE connected to ${apiUrl}`);

      es.onmessage = (event: any) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(accountId, msg);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          log.error?.(`[toq:${accountId}] message error: ${detail}`);
        }
      };

      es.onerror = () => {
        log.warn?.(`[toq:${accountId}] SSE reconnecting...`);
      };

      // Block until abort
      await new Promise<void>((resolve) => {
        if (ctx.abortSignal?.aborted) { es.close(); return resolve(); }
        ctx.abortSignal?.addEventListener("abort", () => {
          es.close();
          state.ws?.close();
          accounts.delete(accountId);
          resolve();
        }, { once: true });
      });
    },
    stopAccount: async () => {},
  },
  outbound: {
    deliveryMode: "direct" as const,
    sendText: async ({ text, target }: { text: string; target: string }) => {
      const client = connect();
      await client.send(target, text);
      return { ok: true };
    },
  },
};

export default function register(api: any): void {
  api.registerChannel({ plugin: toqChannel });
}

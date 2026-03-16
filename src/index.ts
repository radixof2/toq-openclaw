import { connect } from "@toqprotocol/toq";
import { EventSource } from "eventsource";

const DEFAULT_API_URL = "http://127.0.0.1:9009";
export const CHANNEL_ID = "toq";
export const STREAM_CHUNK_TYPE = "message.stream.chunk";
export const STREAM_END_TYPE = "message.stream.end";

export const streamBuffers = new Map<string, { from: string; text: string; threadId?: string }>();

let pluginApi: any = null;

interface AccountState {
  localAddress: string;
}

const accounts = new Map<string, AccountState>();

function getAccount(accountId: string): AccountState {
  let state = accounts.get(accountId);
  if (!state) {
    state = { localAddress: "" };
    accounts.set(accountId, state);
  }
  return state;
}

function getRuntime(): any {
  return pluginApi?.runtime;
}

function dispatchToAgent(accountId: string, from: string, text: string, cfg: any, log: any, threadId?: string): void {
  const rt = getRuntime();
  const dispatch = rt?.channel?.reply?.dispatchReplyWithBufferedBlockDispatcher;
  if (!dispatch) {
    log.warn?.(`[toq:${accountId}] runtime dispatch not available`);
    return;
  }

  const sessionKey = `toq:${accountId}:${from}`;
  const toqClient = connect();

  const ctx = rt.channel.reply.finalizeInboundContext({
    Body: text,
    From: from,
    To: `toq:${accountId}`,
    SessionKey: sessionKey,
    AccountId: accountId,
    ChatType: "direct",
    Provider: "toq",
    Surface: "toq",
    MessageSid: threadId ?? `toq-${Date.now()}`,
    CommandAuthorized: true,
    OriginatingChannel: "toq",
    OriginatingTo: `toq:${accountId}`,
  });

  dispatch({
    ctx,
    cfg,
    dispatcherOptions: {
      deliver: async (payload: any) => {
        const replyText = payload?.text ?? payload?.body ?? "";
        if (!replyText) return;
        try {
          await toqClient.send(from, replyText, { thread_id: threadId });
          log.info?.(`[toq:${accountId}] replied to ${from}`);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          log.error?.(`[toq:${accountId}] reply failed: ${detail}`);
        }
      },
      onError: (err: unknown) => {
        log.error?.(`[toq:${accountId}] dispatch error: ${String(err)}`);
      },
    },
  }).catch((err: unknown) => {
    log.error?.(`[toq:${accountId}] dispatch failed: ${String(err)}`);
  });
}

export function handleMessage(accountId: string, msg: any, cfg: any, log: any): void {
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
      dispatchToAgent(accountId, buf?.from ?? msg.from, fullText, cfg, log, buf?.threadId);
    }
    return;
  }

  const text = body?.text as string;
  if (text && msg.type === "message.send") {
    dispatchToAgent(accountId, msg.from, text, cfg, log, msg.thread_id);
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
      const cfg = ctx.cfg;
      const state = getAccount(accountId);

      // Learn local address to filter outbound messages
      try {
        const client = connect(apiUrl);
        const status = await client.status() as any;
        state.localAddress = status?.address ?? "";
        log.info?.(`[toq:${accountId}] local address: ${state.localAddress}`);
      } catch {}

      // Connect to toq SSE for inbound messages
      const es = new EventSource(`${apiUrl}/v1/messages`);
      log.info?.(`[toq:${accountId}] SSE connected to ${apiUrl}`);

      es.onmessage = (event: any) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(accountId, msg, cfg, log);
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
  pluginApi = api;
  api.registerChannel({ plugin: toqChannel });
}

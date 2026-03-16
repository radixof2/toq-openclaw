import { connect } from "@toqprotocol/toq";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_API_URL = "http://127.0.0.1:9009";
export const CHANNEL_ID = "toq";
export const STREAM_CHUNK_TYPE = "message.stream.chunk";
export const STREAM_END_TYPE = "message.stream.end";

export const streamBuffers = new Map<string, { from: string; text: string; threadId?: string }>();

async function sendToAgent(from: string, text: string, threadId?: string): Promise<void> {
  const meta = threadId ? ` (thread: ${threadId})` : "";
  const message = `Incoming toq message from ${from}${meta}: ${text}`;
  try {
    await execFileAsync("openclaw", ["agent", "--agent", "main", "--message", message]);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[toq] failed to dispatch to agent: ${detail}`);
  }
}

export function handleMessage(msg: any): void {
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
      sendToAgent(buf?.from ?? msg.from, fullText, buf?.threadId);
    }
    return;
  }

  const text = body?.text as string;
  if (text && msg.type === "message.send") {
    sendToAgent(msg.from, text, msg.thread_id);
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
  capabilities: {
    chatTypes: ["direct"] as const,
  },
  config: {
    listAccountIds: (cfg: any) =>
      Object.keys(cfg.channels?.toq?.accounts ?? {}),
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
      cfg.channels.toq.accounts[accountId] = {
        ...cfg.channels.toq.accounts[accountId],
        enabled: true,
      };
      return cfg;
    },
  },
  gateway: {
    startAccount: async (ctx: any) => {
      const apiUrl = ctx.cfg?.channels?.toq?.apiUrl ?? DEFAULT_API_URL;
      const client = connect(apiUrl);
      const log = ctx.log ?? console;
      log.info?.(`[toq] connecting to SSE at ${apiUrl}`);

      while (!ctx.abortSignal?.aborted) {
        try {
          for await (const msg of client.messages()) {
            if (ctx.abortSignal?.aborted) break;
            handleMessage(msg);
          }
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          log.error?.(`[toq] SSE connection lost: ${detail}`);
          if (!ctx.abortSignal?.aborted) {
            await new Promise((r) => setTimeout(r, 5000));
          }
        }
      }
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

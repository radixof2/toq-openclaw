import { connect } from "@toqprotocol/toq";

const DEFAULT_API_URL = "http://127.0.0.1:9010";
export const CHANNEL_ID = "toq";
export const STREAM_CHUNK_TYPE = "message.stream.chunk";
export const STREAM_END_TYPE = "message.stream.end";

/** Buffers stream chunks until StreamEnd arrives. */
export const streamBuffers = new Map<string, { from: string; text: string; threadId?: string }>();

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
    chatTypes: ["direct"],
  },
  config: {
    listAccountIds: (cfg: any) =>
      Object.keys(cfg.channels?.toq?.accounts ?? {}),
    resolveAccount: (cfg: any, id?: string) =>
      cfg.channels?.toq?.accounts?.[id ?? "default"] ?? { accountId: id },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ text, target }: { text: string; target: string }) => {
      const client = connect();
      await client.send(target, text);
      return { ok: true };
    },
  },
};

export default function register(api: any) {
  api.registerChannel({ plugin: toqChannel });

  api.registerService({
    id: "toq-listener",
    start: async (ctx: any) => {
      const apiUrl =
        ctx.config?.channels?.toq?.apiUrl ?? DEFAULT_API_URL;
      const client = connect(apiUrl);

      while (true) {
        try {
          for await (const msg of client.messages()) {
            handleMessage(ctx, msg);
          }
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          console.error(`[toq] SSE connection lost: ${detail}`);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    },
  });
}

export function handleMessage(ctx: any, msg: any): void {
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
      dispatch(ctx, buf?.from ?? msg.from, fullText, buf?.threadId);
    }
    return;
  }

  // Regular message
  const text = body?.text as string;
  if (text) {
    dispatch(ctx, msg.from, text, msg.thread_id);
  }
}

export function dispatch(ctx: any, from: string, text: string, threadId?: string): void {
  ctx.dispatchInboundMessage({
    channel: CHANNEL_ID,
    senderId: from,
    text,
    metadata: { toqThreadId: threadId },
  });
}

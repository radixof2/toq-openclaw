import { connect } from "@toqprotocol/toq";

const DEFAULT_API_URL = "http://127.0.0.1:9009";
export const CHANNEL_ID = "toq";
export const STREAM_CHUNK_TYPE = "message.stream.chunk";
export const STREAM_END_TYPE = "message.stream.end";

/** Buffers stream chunks until StreamEnd arrives. */
export const streamBuffers = new Map<string, { from: string; text: string; threadId?: string }>();

/** Deliver a message into the OpenClaw conversation. */
export function dispatch(ctx: any, from: string, text: string, threadId?: string): void {
  ctx.dispatchInboundMessage({
    channel: CHANNEL_ID,
    senderId: from,
    text,
    metadata: { toqThreadId: threadId },
  });
}

/** Process a single SSE message and dispatch to OpenClaw when ready. */
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
  if (text && msg.type === "message.send") {
    dispatch(ctx, msg.from, text, msg.thread_id);
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
    chatTypes: ["direct"],
  },
  config: {
    listAccountIds: (cfg: any) =>
      Object.keys(cfg.channels?.toq?.accounts ?? {}),
    resolveAccount: (cfg: any, id?: string) =>
      cfg.channels?.toq?.accounts?.[id ?? "default"] ?? { accountId: id ?? "default" },
  },
  gateway: {
    start: async ({ config, logger }: any, ctx: any) => {
      const apiUrl = config?.channels?.toq?.apiUrl ?? DEFAULT_API_URL;
      const client = connect(apiUrl);
      logger?.info?.(`[toq] connecting to SSE at ${apiUrl}`);

      const controller = { running: true };

      (async () => {
        while (controller.running) {
          try {
            for await (const msg of client.messages()) {
              if (!controller.running) break;
              handleMessage(ctx, msg);
            }
          } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            logger?.error?.(`[toq] SSE connection lost: ${detail}`);
            if (controller.running) {
              await new Promise((r) => setTimeout(r, 5000));
            }
          }
        }
      })();

      return controller;
    },
    stop: async (controller: any) => {
      controller.running = false;
    },
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

export default function register(api: any): void {
  api.registerChannel({ plugin: toqChannel });
  api.registerService({
    id: "toq-listener",
    label: "toq listener",
    start: toqChannel.gateway.start,
    stop: toqChannel.gateway.stop,
  });
}

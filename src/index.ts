import { connect } from "@toqprotocol/toq";
import { EventSource } from "eventsource";
import { Type } from "@sinclair/typebox";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

const DEFAULT_DAEMON_URL = "http://127.0.0.1:9009";
const DEFAULT_HOOKS_URL = "http://127.0.0.1:18789";

interface EndpointConfig {
  url: string;
  agentId?: string;
}

interface PluginConfig {
  endpoints?: Record<string, EndpointConfig>;
  hooksToken?: string;
  hooksUrl?: string;
}

const plugin = {
  id: "toq-openclaw",
  name: "toq protocol",
  description: "Secure agent-to-agent communication via toq protocol",
  configSchema: emptyPluginConfigSchema(),
  register(api: any): void {
  const log = api.logger;
  const cfg = (api.pluginConfig ?? {}) as PluginConfig;

  const endpoints: Record<string, EndpointConfig> = cfg.endpoints ?? {
    default: { url: DEFAULT_DAEMON_URL },
  };
  const hooksToken = cfg.hooksToken ?? api.config?.hooks?.token ?? "";
  const hooksUrl = cfg.hooksUrl ?? DEFAULT_HOOKS_URL;

  const connections = new Map<string, EventSource>();
  const clients = new Map<string, ReturnType<typeof connect>>();
  const localAddresses = new Map<string, string>();
  const streamBuffers = new Map<string, { from: string; text: string; threadId?: string }>();

  // --- Service: SSE listener ---

  api.registerService({
    id: "toq-listener",
    start: async () => {
      for (const [name, ep] of Object.entries(endpoints)) {
        const client = connect(ep.url);
        clients.set(name, client);

        try {
          const status = (await client.status()) as any;
          localAddresses.set(name, status?.address ?? "");
          log.info?.(`[toq:${name}] local address: ${localAddresses.get(name)}`);
        } catch {}

        const es = new EventSource(`${ep.url}/v1/messages`);
        connections.set(name, es);
        log.info?.(`[toq:${name}] SSE connected to ${ep.url}`);

        es.onmessage = (event: any) => {
          try {
            const msg = JSON.parse(event.data);
            handleMessage(name, ep, msg);
          } catch (err) {
            log.error?.(`[toq:${name}] parse error: ${err}`);
          }
        };

        es.onerror = () => {
          log.warn?.(`[toq:${name}] SSE reconnecting...`);
        };
      }
    },
    stop: async () => {
      for (const [name, es] of connections) {
        es.close();
        log.info?.(`[toq:${name}] disconnected`);
      }
      connections.clear();
      clients.clear();
      localAddresses.clear();
      streamBuffers.clear();
    },
  });

  // --- Tools ---

  api.registerTool({
    name: "toq_send",
    description: "Send a toq message to a remote agent. Use this to reply to inbound toq messages or start new conversations.",
    input: Type.Object({
      address: Type.String({ description: "Remote agent address (e.g., toq://host/agent)" }),
      text: Type.String({ description: "Message text to send" }),
      thread_id: Type.Optional(Type.String({ description: "Thread ID for continuing a conversation" })),
      endpoint: Type.Optional(Type.String({ description: "Local endpoint name to send from (default: 'default')" })),
    }),
    execute: async (args: any) => {
      const client = clients.get(args.endpoint ?? "default");
      if (!client) return { error: `Unknown endpoint: ${args.endpoint ?? "default"}` };
      await client.send(args.address, args.text, args.thread_id ? { thread_id: args.thread_id } : undefined);
      return { ok: true, sent_to: args.address };
    },
  });

  api.registerTool({
    name: "toq_status",
    description: "Check the status of a toq endpoint daemon.",
    input: Type.Object({
      endpoint: Type.String({ description: "Endpoint name (use 'default' for the default endpoint)" }),
    }),
    execute: async (args: any) => {
      const client = clients.get(args.endpoint ?? "default");
      if (!client) return { error: `Unknown endpoint: ${args.endpoint ?? "default"}` };
      return await client.status();
    },
  });

  api.registerTool({
    name: "toq_peers",
    description: "List known peers for a toq endpoint.",
    input: Type.Object({
      endpoint: Type.String({ description: "Endpoint name (use 'default' for the default endpoint)" }),
    }),
    execute: async (args: any) => {
      const client = clients.get(args.endpoint ?? "default");
      if (!client) return { error: `Unknown endpoint: ${args.endpoint ?? "default"}` };
      return await client.peers();
    },
  });

  api.registerTool({
    name: "toq_approve",
    description: "Approve a pending toq connection request.",
    input: Type.Object({
      id: Type.String({ description: "Peer ID to approve" }),
      endpoint: Type.Optional(Type.String({ description: "Endpoint name (default: 'default')" })),
    }),
    execute: async (args: any) => {
      const client = clients.get(args.endpoint ?? "default");
      if (!client) return { error: `Unknown endpoint: ${args.endpoint ?? "default"}` };
      return await client.approve(args.id);
    },
  });

  api.registerTool({
    name: "toq_block",
    description: "Block a toq peer from connecting.",
    input: Type.Object({
      id: Type.String({ description: "Peer ID to block" }),
      endpoint: Type.Optional(Type.String({ description: "Endpoint name (default: 'default')" })),
    }),
    execute: async (args: any) => {
      const client = clients.get(args.endpoint ?? "default");
      if (!client) return { error: `Unknown endpoint: ${args.endpoint ?? "default"}` };
      return await client.block(args.id);
    },
  });

  // --- Message handling ---

  function handleMessage(name: string, ep: EndpointConfig, msg: any): void {
    const local = localAddresses.get(name) ?? "";
    if (local && msg.from?.includes(local)) return;

    const body = msg.body as Record<string, unknown> | undefined;

    if (msg.type === "message.stream.chunk") {
      const streamId = body?.stream_id as string;
      if (!streamId) return;
      const buf = streamBuffers.get(streamId) ?? { from: msg.from, text: "", threadId: msg.thread_id };
      buf.text += (body?.data as any)?.text ?? "";
      streamBuffers.set(streamId, buf);
      return;
    }

    if (msg.type === "message.stream.end") {
      const streamId = body?.stream_id as string;
      if (!streamId) return;
      const buf = streamBuffers.get(streamId);
      streamBuffers.delete(streamId);
      const finalChunk = (body?.data as any)?.text ?? "";
      const fullText = (buf?.text ?? "") + finalChunk;
      if (fullText) dispatch(name, ep, buf?.from ?? msg.from, fullText, buf?.threadId);
      return;
    }

    if (msg.type === "message.send") {
      const text = body?.text as string;
      if (text) dispatch(name, ep, msg.from, text, msg.thread_id);
    }
  }

  async function dispatch(name: string, ep: EndpointConfig, from: string, text: string, threadId?: string): Promise<void> {
    const trigger = `[toq-inbound] endpoint=${name} from=${from}${threadId ? ` thread=${threadId}` : ""} text=${text}`;
    const payload: Record<string, unknown> = {
      message: trigger,
      name: from,
    };
    if (ep.agentId) payload.agentId = ep.agentId;

    try {
      const res = await fetch(`${hooksUrl}/hooks/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hooksToken}`,
        },
        body: JSON.stringify(payload),
      });
      const result = (await res.json()) as any;
      if (!result.ok) log.error?.(`[toq:${name}] hooks error: ${result.error}`);
      else log.info?.(`[toq:${name}] dispatched from ${from}`);
    } catch (err) {
      log.error?.(`[toq:${name}] dispatch failed: ${err}`);
    }
  }
  } // end register
};

export default plugin;

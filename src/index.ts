import { connect } from "@toqprotocol/toq";

const DEFAULT_API_URL = "http://127.0.0.1:9009";
export const CHANNEL_ID = "toq";

let pluginApi: any = null;

export default function register(api: any): void {
  pluginApi = api;
  // Log all available API methods
  const keys = Object.keys(api).sort();
  api.logger?.info?.(`[toq] plugin API keys: ${keys.join(", ")}`);
  if (api.runtime) {
    const rtKeys = Object.keys(api.runtime).sort();
    api.logger?.info?.(`[toq] api.runtime keys: ${rtKeys.join(", ")}`);
  }
  api.registerChannel({ plugin: toqChannel });
}

const toqChannel = {
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
      const log = ctx.log ?? console;
      log.info?.(`[toq] startAccount ctx keys: ${Object.keys(ctx).sort().join(", ")}`);
      log.info?.(`[toq] pluginApi available: ${!!pluginApi}`);
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

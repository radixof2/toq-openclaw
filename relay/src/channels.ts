import type { Message } from "@toqprotocol/toq";

export interface DeliveryResult {
  delivered: boolean;
  channel: string;
}

export type DeliverFn = (
  agent: string,
  msg: Message,
) => Promise<DeliveryResult>;

/** Default delivery: print to console. */
export const consoleDeliver: DeliverFn = async (_agent, msg) => {
  const body = msg.body as Record<string, unknown> | undefined;
  const text = body?.text ?? (msg.body != null ? JSON.stringify(msg.body) : "(no content)");
  console.log(`[${msg.from}] ${text}`);
  return { delivered: true, channel: "console" };
};

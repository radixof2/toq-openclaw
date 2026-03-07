import { connect } from "@toqprotocol/toq";
import type { Message } from "@toqprotocol/toq";
import { Router } from "./router.js";
import type { DeliverFn } from "./channels.js";

export interface ListenerOptions {
  apiUrl: string;
  router: Router;
  deliver: DeliverFn;
}

export async function listen(opts: ListenerOptions): Promise<void> {
  const client = connect(opts.apiUrl);
  console.log(`Listening on ${opts.apiUrl}`);

  while (true) {
    try {
      for await (const msg of client.messages()) {
        await handleMessage(msg, opts);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`SSE connection lost: ${detail}`);
      console.error("Reconnecting in 5s");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function handleMessage(
  msg: Message,
  opts: ListenerOptions,
): Promise<void> {
  const agent = opts.router.resolve(msg.from);
  try {
    const result = await opts.deliver(agent, msg);
    if (result.delivered) {
      console.log(`Delivered to ${agent} via ${result.channel}`);
    }
  } catch (err) {
    console.error(`Delivery failed for ${msg.id}:`, err);
  }
}

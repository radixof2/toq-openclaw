declare module "toq" {
  export interface Message {
    id: string;
    type: string;
    from: string;
    body?: unknown;
    thread_id?: string;
    reply_to?: string;
    content_type?: string;
    timestamp: string;
    reply: (text: string) => Promise<Record<string, unknown>>;
  }

  export class Client {
    send(
      to: string,
      text: string,
      options?: {
        thread_id?: string;
        reply_to?: string;
        wait?: boolean;
        timeout?: number;
      },
    ): Promise<Record<string, unknown>>;
    messages(): AsyncGenerator<Message>;
    peers(): Promise<unknown[]>;
    block(publicKey: string): Promise<void>;
    unblock(publicKey: string): Promise<void>;
    approvals(): Promise<unknown[]>;
    approve(id: string): Promise<void>;
    deny(id: string): Promise<void>;
    status(): Promise<Record<string, unknown>>;
    health(): Promise<string>;
  }

  export function connect(url?: string): Client;
}

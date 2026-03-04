export interface RoutingConfig {
  defaultAgent: string;
  agents: Record<string, string>;
}

const DEFAULT_CONFIG: RoutingConfig = {
  defaultAgent: "main",
  agents: {},
};

/** Extract agent name from a toq address like toq://host/agent-name */
function agentFromAddress(address: string): string | null {
  const match = address.match(/^toq:\/\/[^/]+\/(.+)$/);
  return match?.[1] ?? null;
}

export class Router {
  private config: RoutingConfig;

  constructor(config?: Partial<RoutingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Resolve a toq address to an OpenClaw agent name. */
  resolve(toAddress: string): string {
    const name = agentFromAddress(toAddress);
    if (name && this.config.agents[name]) {
      return this.config.agents[name];
    }
    return this.config.defaultAgent;
  }
}

#!/usr/bin/env node

import { ensureReady } from "./setup.js";
import { Router } from "./router.js";
import { consoleDeliver } from "./channels.js";
import { listen } from "./listener.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_API_PORT = 9010;
const RELAY_CONFIG_PATH = join(homedir(), ".toq", "relay.json");

interface RelayConfig {
  apiPort?: number;
  agentName?: string;
  routing?: {
    defaultAgent?: string;
    agents?: Record<string, string>;
  };
}

function loadConfig(): RelayConfig {
  try {
    return JSON.parse(readFileSync(RELAY_CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const apiPort = config.apiPort ?? DEFAULT_API_PORT;

  const { bin } = await ensureReady(config.agentName, apiPort);
  console.log(`toq binary: ${bin}`);

  const router = new Router(config.routing);

  await listen({
    apiUrl: `http://127.0.0.1:${apiPort}`,
    router,
    deliver: consoleDeliver,
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

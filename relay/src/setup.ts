import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TOQ_DIR = join(homedir(), ".toq");
const CONFIG_PATH = join(TOQ_DIR, "config.toml");
const STATE_PATH = join(TOQ_DIR, "state.json");
const BIN_PATHS = [
  "toq",
  join(TOQ_DIR, "bin", "toq"),
  "/usr/local/bin/toq",
];

function findBinary(): string | null {
  for (const p of BIN_PATHS) {
    try {
      execFileSync(p, ["--help"], { stdio: "ignore" });
      return p;
    } catch {
      continue;
    }
  }
  return null;
}

function isConfigured(): boolean {
  return existsSync(CONFIG_PATH);
}

function isDaemonRunning(): boolean {
  return existsSync(STATE_PATH);
}

export interface SetupResult {
  bin: string;
  apiPort: number;
}

export async function ensureReady(
  agentName?: string,
  apiPort = 9010,
): Promise<SetupResult> {
  const bin = findBinary();
  if (!bin) {
    throw new Error(
      "toq binary not found. Install from https://github.com/toqprotocol/toq/releases",
    );
  }

  if (!isConfigured()) {
    const name = agentName ?? "agent";
    console.log(`Configuring toq as "${name}" in approval mode`);
    execFileSync(bin, [
      "setup",
      "--non-interactive",
      `--agent-name=${name}`,
      "--connection-mode=approval",
      "--adapter=http",
    ], { stdio: "inherit" });
  }

  if (!isDaemonRunning()) {
    console.log("Starting toq daemon");
    spawn(bin, ["up"], { stdio: "ignore", detached: true }).unref();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (isDaemonRunning()) break;
    }
    if (!isDaemonRunning()) {
      throw new Error("toq daemon failed to start");
    }
  }

  return { bin, apiPort };
}

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules before any imports
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

import { existsSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";

const mockExistsSync = vi.mocked(existsSync);
const mockExecFileSync = vi.mocked(execFileSync);
const mockSpawn = vi.mocked(spawn);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

async function loadSetup() {
  // Re-mock after resetModules
  vi.mock("node:fs", () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }));
  vi.mock("node:child_process", () => ({
    execFileSync: vi.fn(),
    spawn: vi.fn(() => ({ unref: vi.fn() })),
  }));
  return import("../setup.js");
}

describe("ensureReady", () => {
  it("throws when no binary found", async () => {
    const { ensureReady } = await loadSetup();
    const exec = (await import("node:child_process")).execFileSync as any;
    exec.mockImplementation(() => { throw new Error("not found"); });

    await expect(ensureReady()).rejects.toThrow("toq binary not found");
  });

  it("returns bin and port when already configured and running", async () => {
    const { ensureReady } = await loadSetup();
    const exec = (await import("node:child_process")).execFileSync as any;
    const fs = (await import("node:fs")).existsSync as any;

    exec.mockImplementation(() => Buffer.from(""));
    fs.mockReturnValue(true); // config exists AND state exists

    const result = await ensureReady("test-agent", 9009);
    expect(result.bin).toBe("toq");
    expect(result.apiPort).toBe(9009);
  });

  it("runs setup when not configured", async () => {
    const { ensureReady } = await loadSetup();
    const exec = (await import("node:child_process")).execFileSync as any;
    const fs = (await import("node:fs")).existsSync as any;

    let callCount = 0;
    exec.mockImplementation(() => Buffer.from(""));
    fs.mockImplementation((p: string) => {
      if (p.endsWith("config.toml")) return false; // not configured
      if (p.endsWith("state.json")) return true; // daemon running
      return false;
    });

    const result = await ensureReady("my-bot", 9009);
    expect(result.bin).toBe("toq");
    // Verify setup was called (execFileSync called with "setup" arg)
    const setupCalls = exec.mock.calls.filter(
      (c: any[]) => c[1]?.[0] === "setup"
    );
    expect(setupCalls.length).toBe(1);
    expect(setupCalls[0][1]).toContain("--agent-name=my-bot");
  });

  it("uses default agent name when none provided", async () => {
    const { ensureReady } = await loadSetup();
    const exec = (await import("node:child_process")).execFileSync as any;
    const fs = (await import("node:fs")).existsSync as any;

    exec.mockImplementation(() => Buffer.from(""));
    fs.mockImplementation((p: string) => {
      if (p.endsWith("config.toml")) return false;
      if (p.endsWith("state.json")) return true;
      return false;
    });

    await ensureReady();
    const setupCalls = exec.mock.calls.filter(
      (c: any[]) => c[1]?.[0] === "setup"
    );
    expect(setupCalls[0][1]).toContain("--agent-name=agent");
  });

  it("starts daemon when not running", async () => {
    const { ensureReady } = await loadSetup();
    const exec = (await import("node:child_process")).execFileSync as any;
    const fs = (await import("node:fs")).existsSync as any;
    const sp = (await import("node:child_process")).spawn as any;

    exec.mockImplementation(() => Buffer.from(""));
    let stateCheckCount = 0;
    fs.mockImplementation((p: string) => {
      if (p.endsWith("config.toml")) return true; // configured
      if (p.endsWith("state.json")) {
        stateCheckCount++;
        return stateCheckCount > 1; // not running first, then running after spawn
      }
      return false;
    });

    const result = await ensureReady();
    expect(sp).toHaveBeenCalledWith("toq", ["up"], expect.any(Object));
    expect(result.bin).toBe("toq");
  });

  it("throws if daemon fails to start within timeout", async () => {
    const { ensureReady } = await loadSetup();
    const exec = (await import("node:child_process")).execFileSync as any;
    const fs = (await import("node:fs")).existsSync as any;

    exec.mockImplementation(() => Buffer.from(""));
    fs.mockImplementation((p: string) => {
      if (p.endsWith("config.toml")) return true;
      if (p.endsWith("state.json")) return false; // never becomes running
      return false;
    });

    await expect(ensureReady()).rejects.toThrow("toq daemon failed to start");
  }, 10000);
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Mock node modules before importing setup
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setup", () => {
  it("findBinary returns first working path", async () => {
    mockExecFileSync.mockImplementation(() => Buffer.from(""));
    const { ensureReady } = await import("../setup.js");
    mockExistsSync.mockReturnValue(true); // config exists, daemon running
    const result = await ensureReady();
    expect(result.bin).toBe("toq");
  });

  it("findBinary returns null when no binary found", async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });
    // Re-import to get fresh module
    vi.resetModules();
    vi.mock("node:fs", () => ({ existsSync: vi.fn(() => false) }));
    vi.mock("node:child_process", () => ({
      execFileSync: vi.fn(() => { throw new Error("not found"); }),
      spawn: vi.fn(() => ({ unref: vi.fn() })),
    }));
    const { ensureReady } = await import("../setup.js");
    await expect(ensureReady()).rejects.toThrow("toq binary not found");
  });
});

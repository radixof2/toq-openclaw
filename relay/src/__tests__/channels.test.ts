import { describe, it, expect } from "vitest";
import { consoleDeliver } from "../channels.js";

describe("consoleDeliver", () => {
  it("extracts text from body.text", async () => {
    const result = await consoleDeliver("main", {
      id: "1",
      type: "message.send",
      from: "toq://remote/bot",
      body: { text: "hello" },
      timestamp: "2026-01-01T00:00:00Z",
      reply: async () => ({}),
    });
    expect(result.delivered).toBe(true);
    expect(result.channel).toBe("console");
  });

  it("falls back to JSON.stringify for non-text body", async () => {
    const result = await consoleDeliver("main", {
      id: "1",
      type: "message.send",
      from: "toq://remote/bot",
      body: { data: 123 },
      timestamp: "2026-01-01T00:00:00Z",
      reply: async () => ({}),
    });
    expect(result.delivered).toBe(true);
  });

  it("shows no content for null body", async () => {
    const result = await consoleDeliver("main", {
      id: "1",
      type: "message.send",
      from: "toq://remote/bot",
      body: null,
      timestamp: "2026-01-01T00:00:00Z",
      reply: async () => ({}),
    });
    expect(result.delivered).toBe(true);
  });

  it("shows no content for undefined body", async () => {
    const result = await consoleDeliver("main", {
      id: "1",
      type: "message.send",
      from: "toq://remote/bot",
      timestamp: "2026-01-01T00:00:00Z",
      reply: async () => ({}),
    });
    expect(result.delivered).toBe(true);
  });
});

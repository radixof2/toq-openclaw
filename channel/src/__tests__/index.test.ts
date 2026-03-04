import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  handleMessage,
  dispatch,
  streamBuffers,
  toqChannel,
  CHANNEL_ID,
  STREAM_CHUNK_TYPE,
  STREAM_END_TYPE,
} from "../index.js";
import register from "../index.js";

function mockCtx() {
  return { dispatchInboundMessage: vi.fn() };
}

beforeEach(() => {
  streamBuffers.clear();
});

// --- dispatch ---

describe("dispatch", () => {
  it("calls dispatchInboundMessage with correct shape", () => {
    const ctx = mockCtx();
    dispatch(ctx, "toq://remote/bot", "hello", "thread-1");
    expect(ctx.dispatchInboundMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      senderId: "toq://remote/bot",
      text: "hello",
      metadata: { toqThreadId: "thread-1" },
    });
  });

  it("passes undefined threadId in metadata", () => {
    const ctx = mockCtx();
    dispatch(ctx, "toq://remote/bot", "hello");
    expect(ctx.dispatchInboundMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      senderId: "toq://remote/bot",
      text: "hello",
      metadata: { toqThreadId: undefined },
    });
  });
});

// --- handleMessage: regular messages ---

describe("handleMessage regular", () => {
  it("dispatches message with text body", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: "message.send",
      from: "toq://remote/bot",
      body: { text: "hello world" },
      thread_id: "t1",
    });
    expect(ctx.dispatchInboundMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      senderId: "toq://remote/bot",
      text: "hello world",
      metadata: { toqThreadId: "t1" },
    });
  });

  it("does not dispatch when body has no text", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: "message.send",
      from: "toq://remote/bot",
      body: { data: 123 },
    });
    expect(ctx.dispatchInboundMessage).not.toHaveBeenCalled();
  });

  it("does not dispatch when body is null", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: "message.send",
      from: "toq://remote/bot",
      body: null,
    });
    expect(ctx.dispatchInboundMessage).not.toHaveBeenCalled();
  });

  it("does not dispatch when body is undefined", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: "message.send",
      from: "toq://remote/bot",
    });
    expect(ctx.dispatchInboundMessage).not.toHaveBeenCalled();
  });
});

// --- handleMessage: streaming ---

describe("handleMessage streaming", () => {
  it("buffers stream chunks by stream_id", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: STREAM_CHUNK_TYPE,
      from: "toq://remote/bot",
      body: { stream_id: "s1", data: { text: "hello " } },
    });
    expect(ctx.dispatchInboundMessage).not.toHaveBeenCalled();
    expect(streamBuffers.get("s1")?.text).toBe("hello ");
  });

  it("accumulates multiple chunks", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: STREAM_CHUNK_TYPE,
      from: "toq://remote/bot",
      body: { stream_id: "s1", data: { text: "hello " } },
    });
    handleMessage(ctx, {
      type: STREAM_CHUNK_TYPE,
      from: "toq://remote/bot",
      body: { stream_id: "s1", data: { text: "world" } },
    });
    expect(streamBuffers.get("s1")?.text).toBe("hello world");
    expect(ctx.dispatchInboundMessage).not.toHaveBeenCalled();
  });

  it("dispatches complete text on stream end", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: STREAM_CHUNK_TYPE,
      from: "toq://remote/bot",
      body: { stream_id: "s1", data: { text: "hello " } },
      thread_id: "t1",
    });
    handleMessage(ctx, {
      type: STREAM_END_TYPE,
      from: "toq://remote/bot",
      body: { stream_id: "s1", data: { text: "world" } },
    });
    expect(ctx.dispatchInboundMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      senderId: "toq://remote/bot",
      text: "hello world",
      metadata: { toqThreadId: "t1" },
    });
    expect(streamBuffers.has("s1")).toBe(false);
  });

  it("handles stream end without prior chunks", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: STREAM_END_TYPE,
      from: "toq://remote/bot",
      body: { stream_id: "s1", data: { text: "only final" } },
    });
    expect(ctx.dispatchInboundMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      senderId: "toq://remote/bot",
      text: "only final",
      metadata: { toqThreadId: undefined },
    });
  });

  it("does not dispatch empty stream end", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: STREAM_END_TYPE,
      from: "toq://remote/bot",
      body: { stream_id: "s1" },
    });
    expect(ctx.dispatchInboundMessage).not.toHaveBeenCalled();
  });

  it("handles concurrent streams independently", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: STREAM_CHUNK_TYPE,
      from: "toq://a/one",
      body: { stream_id: "s1", data: { text: "aaa" } },
    });
    handleMessage(ctx, {
      type: STREAM_CHUNK_TYPE,
      from: "toq://b/two",
      body: { stream_id: "s2", data: { text: "bbb" } },
    });
    handleMessage(ctx, {
      type: STREAM_END_TYPE,
      from: "toq://a/one",
      body: { stream_id: "s1" },
    });
    expect(ctx.dispatchInboundMessage).toHaveBeenCalledTimes(1);
    expect(ctx.dispatchInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "aaa" }),
    );
    expect(streamBuffers.has("s2")).toBe(true);
  });

  it("ignores chunk without stream_id", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: STREAM_CHUNK_TYPE,
      from: "toq://remote/bot",
      body: { data: { text: "orphan" } },
    });
    expect(streamBuffers.size).toBe(0);
  });

  it("ignores stream end without stream_id", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: STREAM_END_TYPE,
      from: "toq://remote/bot",
      body: {},
    });
    expect(ctx.dispatchInboundMessage).not.toHaveBeenCalled();
  });

  it("chunk with no text appends empty string", () => {
    const ctx = mockCtx();
    handleMessage(ctx, {
      type: STREAM_CHUNK_TYPE,
      from: "toq://remote/bot",
      body: { stream_id: "s1", data: {} },
    });
    expect(streamBuffers.get("s1")?.text).toBe("");
  });
});

// --- toqChannel ---

describe("toqChannel", () => {
  it("has correct id", () => {
    expect(toqChannel.id).toBe("toq");
  });

  it("capabilities include direct chat", () => {
    expect(toqChannel.capabilities.chatTypes).toContain("direct");
  });

  it("config.listAccountIds returns keys from config", () => {
    const cfg = { channels: { toq: { accounts: { default: {}, second: {} } } } };
    expect(toqChannel.config.listAccountIds(cfg)).toEqual(["default", "second"]);
  });

  it("config.listAccountIds returns empty for missing config", () => {
    expect(toqChannel.config.listAccountIds({})).toEqual([]);
  });

  it("config.resolveAccount returns account by id", () => {
    const cfg = { channels: { toq: { accounts: { default: { enabled: true } } } } };
    expect(toqChannel.config.resolveAccount(cfg, "default")).toEqual({ enabled: true });
  });

  it("config.resolveAccount falls back for missing id", () => {
    expect(toqChannel.config.resolveAccount({}, "test")).toEqual({ accountId: "test" });
  });
});

// --- register ---

describe("register", () => {
  it("registers channel and service", () => {
    const api = {
      registerChannel: vi.fn(),
      registerService: vi.fn(),
    };
    register(api);
    expect(api.registerChannel).toHaveBeenCalledWith({ plugin: toqChannel });
    expect(api.registerService).toHaveBeenCalledWith(
      expect.objectContaining({ id: "toq-listener" }),
    );
  });
});

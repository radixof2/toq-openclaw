import { describe, it, expect } from "vitest";
import { Router } from "../router.js";

describe("Router", () => {
  it("returns defaultAgent when no mapping exists", () => {
    const router = new Router();
    expect(router.resolve("toq://remote.com/unknown")).toBe("main");
  });

  it("returns mapped agent for known name", () => {
    const router = new Router({
      agents: { "recipe-bot": "recipe" },
    });
    expect(router.resolve("toq://remote.com/recipe-bot")).toBe("recipe");
  });

  it("returns defaultAgent for unmapped name", () => {
    const router = new Router({
      agents: { "recipe-bot": "recipe" },
    });
    expect(router.resolve("toq://remote.com/other")).toBe("main");
  });

  it("uses custom defaultAgent", () => {
    const router = new Router({ defaultAgent: "custom" });
    expect(router.resolve("toq://remote.com/anything")).toBe("custom");
  });

  it("handles address with port", () => {
    const router = new Router({
      agents: { bot: "mapped" },
    });
    expect(router.resolve("toq://host:9009/bot")).toBe("mapped");
  });

  it("returns default for address without agent name", () => {
    const router = new Router();
    expect(router.resolve("toq://host")).toBe("main");
  });

  it("returns default for empty string", () => {
    const router = new Router();
    expect(router.resolve("")).toBe("main");
  });

  it("returns default for non-toq URL", () => {
    const router = new Router();
    expect(router.resolve("https://example.com/path")).toBe("main");
  });

  it("constructor with undefined config uses defaults", () => {
    const router = new Router(undefined);
    expect(router.resolve("toq://host/agent")).toBe("main");
  });

  it("constructor with partial config fills defaults", () => {
    const router = new Router({ defaultAgent: "custom" });
    expect(router.resolve("toq://host/agent")).toBe("custom");
  });
});

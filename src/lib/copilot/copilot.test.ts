import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { respondOffline, respondToTool } from "./respond-offline";
import { respondWithGemini } from "./gemini-client";
import type { ForecastContext } from "./tools";

const ctx: ForecastContext = { events: [], budgets: [], wishlistGoals: [], openingBalance: 2000, bufferThreshold: 300, historyDays: 5, forecastDays: 35, nextPaydayDate: "2026-10-20T00:00:00.000Z" };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-17T18:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("grounded copilot", () => {
  it("does not invent a payday when no income is scheduled", () => {
    const result = respondOffline("Can I afford $1200?", { ...ctx, nextPaydayDate: null });
    expect(result.comparison).toHaveLength(1);
    expect(result.reply).toContain("No future payday");
  });
  it("parses four-digit unformatted amounts completely", () => {
    const result = respondOffline("Can I afford a $1200 MacBook today?", ctx);
    expect(result.comparison?.[0].minBalance).toBe(800);
    expect(result.actionHref).toContain("amount=1200");
  });
  it("parses formatted amounts and supplies reversible comparison cards", () => {
    const before = JSON.stringify(ctx.events);
    expect(respondOffline("Can I afford a $1,200 MacBook today?", ctx).comparison).toHaveLength(2);
    expect(JSON.stringify(ctx.events)).toBe(before);
  });
  it("checks one-time savings without requiring a wishlist goal", () => {
    expect(respondOffline("Can I save $200 without risking my upcoming bills?", ctx).reply).toContain("$200");
  });
  it.each([NaN, Infinity, -1, 0, "100", 1e20])("rejects invalid Gemini purchase amount %s", (amount) => {
    expect(() => respondToTool("check_affordability", { amount }, ctx)).toThrow();
  });
  it("discards ungrounded Gemini text and discloses local fallback", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: "Your balance is $999999" }] } }] })));
    const result = await respondWithGemini("Can I afford a $1200 MacBook?", ctx);
    expect(result.engine).toBe("fallback");
    expect(result.reply).not.toContain("999999");
    expect(result.comparison?.[0].minBalance).toBe(800);
  });
  it("renders validated Gemini tool results with the same cards and action", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ functionCall: { name: "check_affordability", args: { amount: 1200, label: "MacBook" } } }] } }] })));
    const result = await respondWithGemini("Could I buy a MacBook?", ctx);
    expect(result.engine).toBe("gemini");
    expect(result.comparison?.[0].minBalance).toBe(800);
    expect(result.actionHref).toContain("amount=1200");
  });
  it("does not let malformed tool arguments become financial events", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ functionCall: { name: "check_affordability", args: { amount: -500 } } }] } }] })));
    expect((await respondWithGemini("Can I afford $1200?", ctx)).engine).toBe("fallback");
  });
});

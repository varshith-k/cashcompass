import { afterEach, describe, expect, it, vi } from "vitest";

import { geminiModels, postGemini } from "@/lib/gemini-config";

const KEY = "test-key-should-never-be-logged";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("postGemini", () => {
  it("falls through to the next model on 429/503 and returns the first success", async () => {
    vi.stubEnv("GEMINI_MODEL", "");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postGemini<{ candidates: unknown[] }>(KEY, {}, { timeoutMs: 1000, label: "test" });

    expect(result?.candidates).toHaveLength(1);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls[0]).toContain(geminiModels()[0]);
    expect(urls[2]).toContain(geminiModels()[2]);
    expect(urls.join(" ")).not.toContain(KEY);
    expect(fetchMock.mock.calls[0]![1].headers["x-goog-api-key"]).toBe(KEY);
  });

  it("stops on a non-retryable error and logs why without the key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await postGemini(KEY, {}, { timeoutMs: 1000, label: "copilot" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/\[copilot\] Gemini unavailable \(.+ 400\)/);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(KEY);
  });

  it("tries GEMINI_MODEL first", () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash");
    expect(geminiModels()[0]).toBe("gemini-3.5-flash");
    expect(new Set(geminiModels()).size).toBe(geminiModels().length);
  });
});

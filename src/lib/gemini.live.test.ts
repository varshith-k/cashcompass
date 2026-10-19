// Live Gemini API checks. Skipped unless run via `npm run test:gemini`, so `npm test`
// never needs a key or spends quota. Run with: npm run test:gemini
import { existsSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const LIVE = import.meta.env.MODE === "gemini-live";

describe.skipIf(!LIVE)("Gemini API (live)", () => {
  beforeAll(() => {
    // Next skips .env.local when NODE_ENV=test, so load it directly.
    for (const path of [".env.local", ".env"]) if (existsSync(path)) process.loadEnvFile(path);
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in .env.local");
  });

  // Free-tier keys allow only a few requests per minute; space the calls out.
  afterEach(() => new Promise((resolve) => setTimeout(resolve, 15_000)), 20_000);

  async function context() {
    const { getDemoEvents, DEMO_PREFERRED_BUFFER, DEMO_STARTING_BALANCE } = await import("@/lib/finance/demo-data");
    const events = getDemoEvents();
    const nextPayday = events
      .filter((e) => e.category === "Payroll" && e.record === "planned")
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return {
      events,
      budgets: [{ category: "Dining", monthlyLimit: 150 }],
      wishlistGoals: [{ id: "live-fixture-trip", name: "Miami Trip Goal", targetAmount: 900, targetDate: new Date(Date.now() + 70 * 86400000).toISOString() }],
      openingBalance: DEMO_STARTING_BALANCE,
      bufferThreshold: DEMO_PREFERRED_BUFFER,
      forecastDays: 35,
      historyDays: 5,
      nextPaydayDate: nextPayday?.date ?? new Date().toISOString(),
    };
  }

  it.each([
    "Can I afford a $1,200 MacBook today?",
    "How much should I save every week for my Miami trip?",
    "Show me where I overspent this month.",
  ])("copilot answers with Gemini: %s", async (prompt) => {
    const { respondWithGemini } = await import("@/lib/copilot/gemini-client");
    const result = await respondWithGemini(prompt, await context());
    console.log(`\n[${result.engine}] ${prompt}\n→ ${result.reply}`);
    expect(result.engine).toBe("gemini");
    expect(result.reply.length).toBeGreaterThan(20);
  }, 60_000);

  it.each(["hi", "are u dumb"])("Gemini handles conversational message: %s", async (prompt) => {
    const { respondWithGemini } = await import("@/lib/copilot/gemini-client");
    const result = await respondWithGemini(prompt, await context());
    expect(result.engine).toBe("gemini");
    expect(result.kind).toBe("guidance");
    expect(result.comparison).toBeUndefined();
  }, 60_000);

  it("Gemini clarifies a graduation party budget without treating guests as dollars", async () => {
    const { respondWithGemini } = await import("@/lib/copilot/gemini-client");
    const result = await respondWithGemini("based on my safe to spend im thinking to give party next week because i graduated i will invite 10 people where do we go or what do i do", await context());
    expect(result.engine).toBe("gemini");
    expect(result.kind).toBe("guidance");
    expect(result.reply).toContain("group of 10");
    expect(result.reply).toContain("exact date and city");
    expect(result.reply).toContain("paying for everyone or splitting");
    expect(result.comparison).toBeUndefined();
  }, 60_000);

  it("Gemini explains the previous purchase when asked about its after-payday minimum", async () => {
    const { respondWithGemini } = await import("@/lib/copilot/gemini-client");
    const result = await respondWithGemini("why is it 107 after pay day", await context(), [
      { role: "user", content: "Can I afford a $1,200 MacBook today?" },
      { role: "assistant", content: "The after-payday expected minimum was -$107.06." },
    ]);
    expect(result.engine).toBe("gemini");
    expect(result.reply).toContain("MacBook for $1,200");
    expect(result.reply).toContain("lowest balance across the visible forecast");
    expect(result.reply).toContain("forecast income");
    expect(result.assumptions).toContain("Recalculated from current account records. If your data changed, these figures may differ from the previous reply.");
  }, 60_000);

  it("bill scan reads a bill photo", async () => {
    const sharp = (await import("sharp")).default;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
      <rect width="100%" height="100%" fill="white"/>
      <text x="40" y="70" font-size="34" font-family="Arial" font-weight="bold">Gainesville Regional Utilities</text>
      <text x="40" y="140" font-size="24" font-family="Arial">Electric service statement</text>
      <text x="40" y="210" font-size="28" font-family="Arial">Amount due: $86.42</text>
      <text x="40" y="270" font-size="28" font-family="Arial">Due date: 2026-11-05</text>
    </svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    const { extractBillFromImage } = await import("@/lib/bill-scan/extract");
    const fields = await extractBillFromImage(png.toString("base64"), "image/png");
    console.log("\n[bill-scan]", fields);
    expect(fields?.amount).toBe(86.42);
    expect(fields?.date).toBe("2026-11-05");
    expect(fields?.counterparty).toMatch(/Gainesville/i);
  }, 60_000);
});

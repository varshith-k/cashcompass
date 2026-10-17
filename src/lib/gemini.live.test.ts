// Live Gemini API checks. Skipped unless run via `npm run test:gemini`, so `npm test`
// never needs a key or spends quota. Run with: npm run test:gemini
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const LIVE = import.meta.env.MODE === "gemini-live";

describe.skipIf(!LIVE)("Gemini API (live)", () => {
  beforeAll(() => {
    // Next skips .env.local when NODE_ENV=test, so load it directly.
    process.loadEnvFile(".env.local");
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in .env.local");
  });

  // Free-tier keys allow only a few requests per minute; space the calls out.
  afterEach(() => new Promise((resolve) => setTimeout(resolve, 15_000)), 20_000);

  async function context() {
    const { getDemoEvents, DEMO_PREFERRED_BUFFER, DEMO_STARTING_BALANCE } = await import("@/lib/finance/demo-data");
    const { getBudgets } = await import("@/lib/finance/budgets");
    const { getWishlistGoals } = await import("@/lib/finance/wishlist-goals");
    const events = getDemoEvents();
    const nextPayday = events
      .filter((e) => e.category === "Payroll" && e.record === "planned")
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return {
      events,
      budgets: getBudgets("live-test"),
      wishlistGoals: getWishlistGoals("live-test"),
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

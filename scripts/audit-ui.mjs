// Phase 6 verification: horizontal overflow at the doc's four required
// breakpoints (375/768/1024/1440) and an axe-core accessibility scan,
// across every top-level route. Requires the dev server running at
// localhost:3000 (or pass BASE_URL=... to point elsewhere).
//
// Usage: npm run audit:ui

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ROUTES = [
  "/overview",
  "/transactions",
  "/bills",
  "/budgets",
  "/cash-flow",
  "/ledger",
  "/wishlist",
  "/copilot",
  "/settings",
];
const WIDTHS = [375, 768, 1024, 1440];
const AXE_SOURCE = fs.readFileSync(new URL(import.meta.resolve("axe-core/axe.min.js")), "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();

const overflowIssues = [];
const a11yIssues = [];
async function visit(route) {
  const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`${route} returned HTTP ${response?.status()}`);
  await page.locator("main").waitFor();
  if (await page.getByText("Unable to load your financial data", { exact: true }).count()) throw new Error(`${route} rendered its error boundary`);
}


await visit("/overview");
for (const theme of ["light", "dark"]) {
await page.evaluate((theme) => localStorage.setItem("theme", theme), theme);
for (const route of ROUTES) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await visit(route);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    if (scrollWidth > clientWidth + 1) {
      overflowIssues.push({ theme, route, width, scrollWidth, clientWidth, overflowBy: scrollWidth - clientWidth });
    }
  }

  // Mobile and desktop expose different controls. Check both in each theme.
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await visit(route);
    await page.evaluate(AXE_SOURCE);
    const results = await page.evaluate(async () => await window.axe.run({ exclude: ["nextjs-portal"] }));
    for (const violation of results.violations) {
      a11yIssues.push({ theme, route, width, id: violation.id, impact: violation.impact, help: violation.help,
        nodes: violation.nodes.map((n) => ({ target: n.target.join(" "), html: n.html, failure: n.failureSummary })),
      });
    }
  }
}

}

await browser.close();

console.log("=== HORIZONTAL OVERFLOW ===");
if (overflowIssues.length === 0) {
  console.log(`None found across ${ROUTES.length} routes x ${WIDTHS.length} widths x 2 themes.`);
} else {
  for (const issue of overflowIssues) console.log(JSON.stringify(issue));
}

console.log("\n=== ACCESSIBILITY (axe-core) ===");
if (a11yIssues.length === 0) {
  console.log("No violations found.");
} else {
  for (const issue of a11yIssues) console.log(JSON.stringify(issue, null, 2));
}

process.exit(overflowIssues.length === 0 && a11yIssues.length === 0 ? 0 : 1);

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

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    if (scrollWidth > clientWidth + 1) {
      overflowIssues.push({ route, width, scrollWidth, clientWidth, overflowBy: scrollWidth - clientWidth });
    }
  }

  // Contrast/labels/focus don't change by breakpoint, so one axe pass per route is enough.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.evaluate(AXE_SOURCE);
  const results = await page.evaluate(async () => await window.axe.run());

  for (const violation of results.violations) {
    a11yIssues.push({
      route,
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((n) => ({ target: n.target.join(" "), html: n.html })),
    });
  }
}

await browser.close();

console.log("=== HORIZONTAL OVERFLOW ===");
if (overflowIssues.length === 0) {
  console.log(`None found across ${ROUTES.length} routes x ${WIDTHS.length} widths.`);
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

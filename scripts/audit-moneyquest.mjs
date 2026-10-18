// Read-only browser checks. Run against a local, isolated demo server; never writes finance data.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://localhost:3101";
const expectedLaunch = process.env.MONEYQUEST_EXPECT_LAUNCH_URL || "https://www.roblox.com/games/73262786586748";
const screenshots = process.env.MONEYQUEST_SCREENSHOT_DIR || path.join(os.tmpdir(), "cashcompass-moneyquest-ui");
const axe = fs.readFileSync(new URL(import.meta.resolve("axe-core/axe.min.js")), "utf8");
fs.mkdirSync(screenshots, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = [];
try {
  for (const theme of ["light", "dark"]) {
    await page.goto(`${base}/moneyquest`);
    await page.evaluate((value) => localStorage.setItem("theme", value), theme);
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(`${base}/moneyquest`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, "MoneyQuest must render successfully");
      assert.equal(await page.title(), "MoneyQuest | CashCompass");
      const main = page.locator("main");
      await main.getByRole("heading", { name: "MoneyQuest.", exact: true }).waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `Horizontal overflow at ${width}px in ${theme}: ${overflow}px`);
      const launch = main.getByRole("link", { name: /Open MoneyQuest on Roblox/ });
      assert.equal(await launch.getAttribute("href"), expectedLaunch);
      assert.equal(await launch.getAttribute("target"), "_blank");
      assert.match(await launch.getAttribute("rel"), /noopener/);
      assert.equal(await main.getByText("Game publishing in progress", { exact: true }).count(), 0);
      await main.getByText("Opens the game’s Roblox page in a new tab. Sign-in, age, and playtester restrictions may apply.", { exact: true }).waitFor();
      assert.equal(await main.getByRole("link", { name: "Try the real What-If Simulator" }).getAttribute("href"), "/cash-flow");
      if (width >= 1024) {
        const nav = page.locator("aside nav");
        const routes = await nav.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
        assert.equal(routes[routes.indexOf("/cash-flow") + 1], "/moneyquest");
        assert.equal(await nav.getByRole("link", { name: "MoneyQuest", exact: true }).getAttribute("aria-current"), "page");
      }
      if (width === 375) {
        const more = page.getByRole("button", { name: "More navigation options" });
        const bottom = page.getByRole("navigation").filter({ has: more });
        assert.deepEqual(await bottom.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href"))), ["/overview", "/cash-flow", "/copilot"]);
        await more.click();
        const link = page.getByRole("dialog").getByRole("link", { name: "MoneyQuest", exact: true });
        await link.waitFor({ state: "visible" });
        await link.click();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      }
      await page.evaluate(axe);
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run({ exclude: ["nextjs-portal"] });
        return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
      });
      assert.deepEqual(violations, [], `Accessibility violations: ${JSON.stringify(violations)}`);
      if (width === 375 || width === 1440) {
        await page.screenshot({ path: path.join(screenshots, `moneyquest-${theme}-${width}.png`), fullPage: true });
      }
      report.push({ theme, width, overflow: false, accessibilityViolations: 0 });
    }
  }
  await page.getByRole("link", { name: "Try the real What-If Simulator" }).click();
  await page.waitForURL("**/cash-flow");
  await page.locator("main").getByRole("heading", { name: "Cash Flow", exact: true }).waitFor();
  assert.equal(await page.getByText("Unable to load your financial data", { exact: true }).count(), 0);
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log(JSON.stringify({ report, cashFlowNavigation: "passed", runtimeErrors: errors, screenshots }, null, 2));
} finally {
  await browser.close();
}

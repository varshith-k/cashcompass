// Behavioral accessibility checks against the local keyless demo; never saves records.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  async function visit(path) {
    const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    assert(response?.ok(), `${path} did not load`);
    await page.locator("main").waitFor();
  }
  async function focused(locator) {
    await page.waitForFunction((element) => element === document.activeElement, await locator.elementHandle(), { timeout: 1500 });
  }
  async function trapped(dialog) {
    const element = await dialog.elementHandle();
    // Base UI briefly focuses a hidden guard before wrapping back into the popup.
    for (const key of [...Array(24).fill("Tab"), ...Array(24).fill("Shift+Tab")]) {
      await page.keyboard.press(key);
      await page.waitForFunction((popup) => popup.contains(document.activeElement), element, { timeout: 1500 });
    }
  }
  async function menuKeyboard(trigger) {
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await menu.waitFor();
    await page.keyboard.press("Home");
    await focused(menu.getByRole("menuitem").first());
    await page.keyboard.press("End");
    await focused(menu.getByRole("menuitem").last());
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden" });
    await focused(trigger);
  }

  await visit("/overview");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content", exact: true });
  await focused(skip);
  await page.keyboard.press("Enter");
  await focused(page.locator("main"));
  console.log("PASS first Tab → skip navigation → main focus");

  await menuKeyboard(page.getByRole("button", { name: /User menu/ }));
  await menuKeyboard(page.getByRole("button", { name: /^Notifications/ }));
  console.log("PASS account/notification menus: keyboard navigation, Escape, focus return");

  const theme = page.getByRole("button", { name: "Toggle theme", exact: true });
  const wasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  await theme.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction((previous) => document.documentElement.classList.contains("dark") !== previous, wasDark);
  await page.keyboard.press("Enter");
  console.log("PASS keyboard theme switch");

  await visit("/transactions");
  const add = page.getByRole("button", { name: "Add transaction", exact: true });
  await add.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Add transaction", exact: true });
  await dialog.waitFor();
  await trapped(dialog);
  await dialog.getByLabel("Category", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("listbox").waitFor();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.getByRole("listbox").waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await focused(add);
  console.log("PASS transaction dialog: bidirectional focus trap, category selection, Escape, focus return");

  await page.setViewportSize({ width: 375, height: 900 });
  const mobile = page.getByRole("button", { name: "Open navigation", exact: true });
  await mobile.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "CashCompass", exact: true });
  await drawer.waitFor();
  await trapped(drawer);
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden" });
  await focused(mobile);
  await page.keyboard.press("Enter");
  await drawer.getByRole("link", { name: "Budgets", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/budgets");
  await drawer.waitFor({ state: "hidden" });
  assert.equal(await page.title(), "Budgets | CashCompass");
  console.log("PASS mobile drawer: focus trap, Escape, focus return, keyboard route selection");

  const titles = new Set();
  for (const route of ["overview", "transactions", "bills", "budgets", "cash-flow", "ledger", "wishlist", "copilot", "settings"]) {
    await visit(`/${route}`);
    const title = await page.title();
    assert(title.endsWith(" | CashCompass"), `${route} has no descriptive title`);
    assert(!titles.has(title), `${route} reuses another route's title`);
    titles.add(title);
  }
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log("PASS unique route titles for assistive technology; no browser runtime errors");
} finally {
  await browser.close();
}

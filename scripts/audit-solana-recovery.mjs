// Run against a local demo server: BASE_URL=http://localhost:3217 node scripts/audit-solana-recovery.mjs
// Aborts verification actions and blocks RPC: never signs, submits, or records a payment.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.BASE_URL ?? "http://localhost:3217";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Local demo server required");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let actions = 0, rpc = 0;
  await page.route("**/*", async route => {
    const request = route.request();
    if (request.url().includes("api.devnet.solana.com")) { rpc++; return route.abort(); }
    if (request.method() === "POST" && request.headers()["next-action"]) { actions++; return route.abort(); }
    return route.continue();
  });
  await page.goto(`${base}/settle-up`);
  const open = () => page.getByRole("button", { name: "Pay with Solana", exact: true }).first().click();
  await open();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByPlaceholder("Transaction signature from Phantom");
  await input.fill("not-a-signature");
  await dialog.getByRole("button", { name: "Retry verification — no new transfer" }).press("Enter");
  await dialog.getByText("Enter the transaction signature from Phantom", { exact: false }).waitFor();
  assert.equal(actions, 0);
  await input.fill("1".repeat(88));
  await dialog.getByRole("button", { name: "Retry verification — no new transfer" }).press("Enter");
  await dialog.getByText("CashCompass could not verify or record this transaction.", { exact: false }).waitFor();
  assert.equal(actions, 1);
  assert.equal(await dialog.getByRole("button", { name: "Send devnet payment", exact: true }).count(), 0);
  await page.keyboard.press("Escape");
  await open();
  await dialog.getByText("A transaction signature is saved.", { exact: false }).waitFor();
  await page.reload();
  await open();
  await dialog.getByText("A transaction signature is saved.", { exact: false }).waitFor();
  await dialog.getByRole("button", { name: "Retry verification — no new transfer" }).press("Enter");
  await dialog.getByText("CashCompass could not verify or record this transaction.", { exact: false }).waitFor();
  assert.equal(actions, 2);
  assert.equal(rpc, 0);
  console.log("PASS: invalid input blocked; failed recording retained its signature across close/reload; retries made zero wallet/RPC sends.");
} finally { await browser.close(); }

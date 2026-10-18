#!/usr/bin/env node
/**
 * One-time seed script for a Capital One Nessie sandbox demo customer.
 *
 * Creates a customer, one checking account (~$2,000), a merchant, a few
 * recent purchases, a Friday paycheck deposit, and a rent bill due the next
 * Tuesday — the "you can afford the coffee, not rent on Tuesday" story that
 * CashCompass's forecast is built to surface.
 *
 * Usage:
 *   NESSIE_API_KEY=your_key node scripts/seed-nessie-demo.mjs
 *
 * Prints the resulting NESSIE_CUSTOMER_ID and NESSIE_ACCOUNT_ID to paste
 * into .env.local. Safe to re-run — it always creates a *new* customer, so
 * run it once and keep the printed ids; don't run it again unless you want
 * a second, separate demo customer.
 *
 * This only talks to Nessie's sandbox — no real bank data, no real money.
 * If Nessie's current API rejects a request body shape below (their schema
 * has been stable for years but isn't re-verified by this script), the
 * error print includes the raw response — check http://api.nessieisreal.com
 * for the current field list and adjust the body below.
 */

const KEY = process.env.NESSIE_API_KEY;
const BASE_URL = process.env.NESSIE_API_BASE_URL || "https://api.nessieisreal.com";

if (!KEY) {
  console.error("Set NESSIE_API_KEY before running this script.");
  console.error("  NESSIE_API_KEY=your_key node scripts/seed-nessie-demo.mjs");
  process.exit(1);
}

function nextWeekday(targetDow) {
  // 0=Sun..6=Sat. Returns an ISO date string (YYYY-MM-DD) for the next
  // upcoming occurrence of that weekday, strictly after today.
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  const diff = ((targetDow - date.getUTCDay() + 7) % 7) || 7;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

async function nessie(method, path, body) {
  const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(KEY)}`;
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!response.ok) {
    console.error(`\n${method} ${path} -> ${response.status}`);
    console.error(JSON.stringify(json, null, 2));
    throw new Error(`Nessie request failed: ${response.status} ${path}`);
  }
  return json;
}

async function main() {
  console.log("Creating demo customer...");
  const customer = await nessie("POST", "/customers", {
    first_name: "Jordan",
    last_name: "Demo",
    address: {
      street_number: "123",
      street_name: "Campus Ave",
      city: "Columbia",
      state: "MO",
      zip: "65201",
    },
  });
  const customerId = customer.objectCreated?._id ?? customer._id;
  console.log("  customer id:", customerId);

  console.log("Creating checking account (~$2,000)...");
  const account = await nessie("POST", `/customers/${customerId}/accounts`, {
    type: "Checking",
    nickname: "CashCompass Demo Checking",
    rewards: 0,
    balance: 2000,
  });
  const accountId = account.objectCreated?._id ?? account._id;
  console.log("  account id:", accountId);

  console.log("Creating a merchant for purchases...");
  const merchant = await nessie("POST", "/merchants", {
    name: "Campus Grounds Coffee",
    category: "coffee shop",
    address: {
      street_number: "10",
      street_name: "Main St",
      city: "Columbia",
      state: "MO",
      zip: "65201",
    },
    geocode: { lat: 38.9517, lng: -92.3341 },
  });
  const merchantId = merchant.objectCreated?._id ?? merchant._id;
  console.log("  merchant id:", merchantId);

  console.log("Seeding recent purchases...");
  await nessie("POST", `/accounts/${accountId}/purchases`, {
    merchant_id: merchantId,
    medium: "balance",
    purchase_date: daysAgo(1),
    amount: 6.5,
    status: "completed",
    description: "Coffee",
  });
  await nessie("POST", `/accounts/${accountId}/purchases`, {
    merchant_id: merchantId,
    medium: "balance",
    purchase_date: daysAgo(2),
    amount: 86.42,
    status: "completed",
    description: "Groceries",
  });
  await nessie("POST", `/accounts/${accountId}/purchases`, {
    merchant_id: merchantId,
    medium: "balance",
    purchase_date: daysAgo(3),
    amount: 41.2,
    status: "completed",
    description: "Gas",
  });

  console.log("Seeding Friday paycheck deposit...");
  await nessie("POST", `/accounts/${accountId}/deposits`, {
    medium: "balance",
    transaction_date: nextWeekday(5), // Friday
    status: "pending",
    amount: 650,
    description: "Payroll — Horizon Labs Inc.",
  });

  console.log("Seeding rent bill due next Tuesday...");
  await nessie("POST", `/accounts/${accountId}/bills`, {
    status: "pending",
    payee: "Lakeview Apartments",
    nickname: "Rent",
    payment_date: nextWeekday(2), // Tuesday
    recurring_date: 1,
    payment_amount: 1200,
  });

  console.log("Seeding roommate repayment (modeled as a deposit — Nessie's");
  console.log("transfer endpoint isn't read by src/lib/nessie/sync.ts today):");
  await nessie("POST", `/accounts/${accountId}/deposits`, {
    medium: "balance",
    transaction_date: nextWeekday(2),
    status: "pending",
    amount: 150,
    description: "Roommate transfer — rent split",
  });

  console.log("\nDone. Add these to .env.local (and your production env):\n");
  console.log(`NESSIE_CUSTOMER_ID=${customerId}`);
  console.log(`NESSIE_ACCOUNT_ID=${accountId}`);
  console.log("\nThen in CashCompass: Settings -> select the account -> Sync.");
}

main().catch((error) => {
  console.error("\nSeed failed:", error.message);
  process.exit(1);
});

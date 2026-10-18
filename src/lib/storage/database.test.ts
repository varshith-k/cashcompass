import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const session = vi.hoisted(() => ({ owner: `verification|${crypto.randomUUID()}` }));
vi.mock("@/lib/auth/session", () => ({ requireOwnerId: async () => session.owner }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getFinancialEventRepository, withFinancialTransaction } from "@/lib/finance/repository";
import { getBudgets, setBudgetLimits } from "@/lib/finance/budgets";
import { addWishlistGoal, getWishlistGoals } from "@/lib/finance/wishlist-goals";
import { addWishlistContribution, markBillPaid, undoMarkBillPaid, planWishlistSavings, saveBalanceCheckpoint } from "@/lib/finance/actions";
import { settleLedgerAmount } from "@/lib/finance/ledger";
import { claimSettlement } from "@/lib/solana/receipts";
import { getBalanceBasis } from "@/lib/finance/balance";
import { computeAvailableBalance } from "@/lib/finance/calculations";
import { updatePlanningProfile } from "./profile";

const enabled = import.meta.env.MODE === "database";
const fixture = { date: new Date().toISOString(), amount: 100, direction: "expense" as const, record: "planned" as const, certainty: "certain" as const, recurrence: "recurring" as const, source: "manual" as const, category: "Utilities", counterparty: "Verification energy" };
let pool: Pool;
function form(values: Record<string, string>) { const data = new FormData(); for (const [k, v] of Object.entries(values)) data.set(k, v); return data; }

describe.skipIf(!enabled)("PostgreSQL persistence and atomic mutations", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error("Set TEST_DATABASE_URL to a disposable local verification database");
    const parsed = new URL(url);
    if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !/verification|test/.test(parsed.pathname)) throw new Error("Database tests only run against a named local test database");
    parsed.searchParams.set("sslmode", "disable");
    vi.stubEnv("DATABASE_URL", parsed.toString());
    pool = new Pool({ connectionString: url });
    const schema = await readFile("db/schema.sql", "utf8");
    if (process.env.TEST_TIMESCALE === "true") await pool.query(schema);
    else {
      const core = schema.slice(0, schema.indexOf("-- Hypertable")).replace("CREATE EXTENSION IF NOT EXISTS timescaledb;", "");
      const planning = schema.slice(schema.indexOf("-- A devnet transaction"));
      await pool.query(core + planning);
    }
  });
  afterAll(async () => {
    if (pool) {
      const ready = await pool.query("SELECT to_regclass('financial_events') AS events, to_regclass('planning_profiles') AS profiles, to_regclass('solana_settlement_receipts') AS receipts");
      if (ready.rows[0].events) await pool.query("DELETE FROM financial_events WHERE owner_id = $1", [session.owner]);
      if (ready.rows[0].profiles) await pool.query("DELETE FROM planning_profiles WHERE owner_id = $1", [session.owner]);
      if (ready.rows[0].receipts) await pool.query("DELETE FROM solana_settlement_receipts WHERE owner_id = $1", [session.owner]);
      await pool.end();
    }
    vi.unstubAllEnvs();
  });
  it("persists goals and budgets in a fresh database connection", async () => {
    await setBudgetLimits(session.owner, { Dining: 123 });
    const target = new Date(); target.setUTCDate(target.getUTCDate() + 21);
    const goal = await addWishlistGoal(session.owner, { name: "Database verification goal", targetAmount: 100, targetDate: target.toISOString() });
    const stored = await pool.query("SELECT data FROM planning_profiles WHERE owner_id = $1", [session.owner]);
    expect(stored.rows[0].data.budgets.find((b: {category: string}) => b.category === "Dining").monthlyLimit).toBe(123);
    expect(stored.rows[0].data.goals.some((g: {id: string}) => g.id === goal.id)).toBe(true);
  });
  it("rolls back profile, event and signature writes together", async () => {
    const repo = getFinancialEventRepository();
    const before = await repo.listEvents();
    const signature = crypto.randomUUID();
    await expect(withFinancialTransaction(async (ownerId) => {
      await repo.createEvent(fixture);
      await setBudgetLimits(ownerId, { Dining: 999 });
      await claimSettlement(signature, ownerId, "rollback-entry");
      throw new Error("force rollback");
    })).rejects.toThrow("force rollback");
    expect(await repo.listEvents()).toEqual(before);
    expect((await getBudgets(session.owner)).find((b) => b.category === "Dining")?.monthlyLimit).toBe(123);
    expect((await pool.query("SELECT signature FROM solana_settlement_receipts WHERE signature = $1", [signature])).rowCount).toBe(0);
  });
  it("renews a bill only once under concurrent payment requests", async () => {
    const bill = await getFinancialEventRepository().createEvent(fixture);
    const results = await Promise.allSettled([markBillPaid(form({ id: bill.id })), markBillPaid(form({ id: bill.id }))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const events = await getFinancialEventRepository().listEvents();
    expect(events.filter((e) => e.counterparty === fixture.counterparty && e.record === "planned")).toHaveLength(1);
  });
  it("rejects a concurrent overpayment without double-recording cash", async () => {
    const entry = await getFinancialEventRepository().createEvent({ ...fixture, category: "Repayment", counterparty: "Concurrent verification", recurrence: "one-time" });
    const results = await Promise.allSettled([settleLedgerAmount(entry.id, 80), settleLedgerAmount(entry.id, 80)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const entries = (await getFinancialEventRepository().listEvents()).filter((e) => e.counterparty === "Concurrent verification");
    expect(entries.find((e) => e.record === "planned")?.amount).toBe(20);
    expect(entries.filter((e) => e.record === "actual").reduce((sum, e) => sum + e.amount, 0)).toBe(80);
  });
  it("undoes a recurring payment once under concurrent requests", async () => {
    const repo = getFinancialEventRepository();
    const bill = await repo.createEvent({ ...fixture, counterparty: "Undo verification" });
    const undo = await markBillPaid(form({ id: bill.id }));
    const results = await Promise.allSettled([undoMarkBillPaid(undo), undoMarkBillPaid(undo)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const entries = (await repo.listEvents()).filter((event) => event.counterparty === "Undo verification");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: bill.id, record: "planned", date: bill.date });
  });
  it("replaces scheduled savings when a contribution is confirmed", async () => {
    const goal = (await getWishlistGoals(session.owner)).find((g) => g.name === "Database verification goal")!;
    await planWishlistSavings(form({ goalId: goal.id, weeklyAmount: "40" }));
    await addWishlistContribution(form({ goalName: goal.name, amount: "25" }));
    const entries = (await getFinancialEventRepository().listEvents()).filter((e) => e.counterparty === goal.name);
    expect(entries.filter((e) => e.record === "planned").reduce((sum, e) => sum + e.amount, 0)).toBe(75);
    expect(entries.find((e) => e.record === "actual")?.amount).toBe(25);
  });
  it("does not replay imported amounts already reflected in account balances", async () => {
    await updatePlanningProfile(session.owner, (profile) => {
      profile.accountSnapshots = { checking: { balance: 500, timestamp: new Date().toISOString(), reflectedEvents: { purchase: -100, deposit: 200 } } };
    });
    const basis = await getBalanceBasis(session.owner);
    expect(basis).toMatchObject({ source: "nessie", openingBalance: 400 });
    expect(computeAvailableBalance(basis.openingBalance, [{ ...fixture, id: "purchase", record: "actual", amount: 100 }, { ...fixture, id: "deposit", record: "actual", direction: "income", amount: 200 }])).toBe(500);
  });
  it("saves an observed balance without double-counting recorded activity", async () => {
    await saveBalanceCheckpoint(form({ balance: "1000" }));
    const events = await getFinancialEventRepository().listEvents();
    const basis = await getBalanceBasis(session.owner);
    expect(computeAvailableBalance(basis.openingBalance, events)).toBe(1000);
    await getFinancialEventRepository().createEvent({ ...fixture, record: "actual", recurrence: "one-time", amount: 10 });
    expect(computeAvailableBalance(basis.openingBalance, await getFinancialEventRepository().listEvents())).toBe(990);
  });
});

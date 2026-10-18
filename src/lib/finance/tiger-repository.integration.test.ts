import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { TigerDataFinancialEventStore, getTigerPool } from "./tiger-repository";

// Opt-in only, and restricted to a disposable local database.
const uri = process.env.TIGER_TEST_DATABASE_URL;
describe.skipIf(!uri)("Timescale partition-changing updates", () => {
  let admin: Pool;
  const store = new TigerDataFinancialEventStore();
  beforeAll(async () => {
    const target = new URL(uri!);
    if (!["localhost", "127.0.0.1", "::1"].includes(target.hostname)) throw new Error("Local test database required");
    vi.stubEnv("DATABASE_URL", uri!);
    admin = new Pool({ connectionString: uri });
    const schema = await readFile("db/schema.sql", "utf8");
    await admin.query(schema.split("-- Compression:")[0]);
  });
  afterAll(async () => {
    await getTigerPool().end();
    await admin?.end();
    vi.unstubAllEnvs();
  });
  async function planned() {
    return store.createEvent("test-owner", {
      date: "2026-10-25T00:00:00.000Z", amount: 10, direction: "expense", record: "planned",
      certainty: "certain", recurrence: "one-time", source: "manual", category: "Repayment",
      counterparty: "Test friend", friendId: "friend-test", sourceRecordId: "shared/test",
      notes: "Keep shared bill details", isReceipt: false,
    });
  }
  it("reproduces the old chunk constraint failure, then moves the payment atomically with its links intact", async () => {
    const event = await planned();
    await expect(admin.query("UPDATE financial_events SET event_date=$2 WHERE id=$1", [event.id, "2026-10-18T10:34:46.345Z"])).rejects.toMatchObject({ code: "23514" });
    const saved = await store.updateEvent("test-owner", event.id, { date: "2026-10-18T10:34:46.345Z", record: "actual" });
    expect(saved).toMatchObject({ ...event, date: "2026-10-18T10:34:46.345Z", record: "actual" });
    const rows = await admin.query("SELECT count(*)::int AS count FROM financial_events WHERE id=$1", [event.id]);
    expect(rows.rows[0].count).toBe(1);
  });
  it("rolls back the deletion if the replacement violates a constraint", async () => {
    const event = await planned();
    await expect(store.updateEvent("test-owner", event.id, { date: "2026-10-18T00:00:00.000Z", record: "invalid" as never })).rejects.toMatchObject({ code: "23514" });
    expect((await store.listEvents("test-owner")).find(row => row.id === event.id)).toEqual(event);
  });
  it("cannot move another owner's row", async () => {
    const event = await planned();
    await expect(store.updateEvent("another-owner", event.id, { date: "2026-10-18T00:00:00.000Z" })).rejects.toThrow(/not found/);
    expect((await store.listEvents("test-owner")).find(row => row.id === event.id)).toEqual(event);
  });
});

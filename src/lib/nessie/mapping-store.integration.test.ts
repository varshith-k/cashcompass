import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { NESSIE_MAPPING_DDL, PostgresNessieMappingStore } from "./mapping-store";
import type { NessieMapping } from "./provisioning";

const connectionString = process.env.NESSIE_TEST_DATABASE_URL;
// Never point integration tests at the configured application/production database.
if (connectionString) {
  const url = new URL(connectionString);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/cashcompass_nessie_test") throw new Error("Use the isolated localhost test database only.");
}
const pool = connectionString ? new Pool({ connectionString, ssl: false }) : null;
const mapping = (owner: string, account: string): NessieMapping => ({
  owner_id: owner, provisioning_token: `token-${owner}`, customer_id: `customer-${owner}`, account_id: account,
  customer_attempted: true, account_attempted: true,
});

describe.skipIf(!pool)("Nessie mapping store against isolated PostgreSQL", () => {
  beforeAll(async () => { await pool!.query("DROP TABLE IF EXISTS nessie_user_accounts"); });
  afterAll(async () => { await pool!.end(); });

  it("keeps migration DDL aligned with the runtime initializer", () => {
    const sql = readFileSync("db/migrations/20261018_nessie_user_accounts.sql", "utf8");
    expect(sql).toContain(`${NESSIE_MAPPING_DDL};`);
    expect(readFileSync("db/schema.sql", "utf8")).toContain(`${NESSIE_MAPPING_DDL};`);
  });
  it("initializes safely across processes and persists separate users across store recreation", async () => {
    const first = new PostgresNessieMappingStore(pool!);
    const second = new PostgresNessieMappingStore(pool!);
    await Promise.all([
      first.withOwnerLock("alice", async (session) => session.save(mapping("alice", "account-alice"))),
      second.withOwnerLock("bob", async (session) => session.save(mapping("bob", "account-bob"))),
    ]);
    const restarted = new PostgresNessieMappingStore(pool!);
    expect(await restarted.get("alice")).toMatchObject(mapping("alice", "account-alice"));
    expect(await restarted.get("bob")).toMatchObject(mapping("bob", "account-bob"));
    expect(await restarted.get("unknown")).toBeNull();
  });
  it("keeps committed partial checkpoints after provisioning fails", async () => {
    const store = new PostgresNessieMappingStore(pool!);
    await expect(store.withOwnerLock("partial", async (session) => {
      await session.save({ ...mapping("partial", "unused"), account_id: null });
      throw new Error("remote request timed out");
    })).rejects.toThrow("timed out");
    expect(await new PostgresNessieMappingStore(pool!).get("partial")).toMatchObject({ customer_id: "customer-partial", account_id: null, account_attempted: true });
  });
  it("enforces unique customers/accounts across users", async () => {
    const store = new PostgresNessieMappingStore(pool!);
    await expect(store.withOwnerLock("mallory", async (session) => session.save(mapping("mallory", "account-alice")))).rejects.toMatchObject({ code: "23505" });
    expect(await store.get("mallory")).toBeNull();
    await expect(store.withOwnerLock("mallory", async (session) => session.save({ ...mapping("mallory", "unique-account"), customer_id: "customer-alice" }))).rejects.toMatchObject({ code: "23505" });
  });
  it("excludes another worker for the same user, permits other users, and releases locks after failure", async () => {
    const first = new PostgresNessieMappingStore(pool!);
    const other = new PostgresNessieMappingStore(pool!);
    let unlock!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const work = first.withOwnerLock("locked", async () => { started(); await new Promise<void>((resolve) => { unlock = resolve; }); });
    await ready;
    await expect(other.withOwnerLock("locked", async () => undefined)).rejects.toThrow("being prepared");
    await expect(other.withOwnerLock("different", async () => "ok")).resolves.toBe("ok");
    unlock(); await work;
    await expect(other.withOwnerLock("locked", async () => { throw new Error("failed"); })).rejects.toThrow("failed");
    await expect(first.withOwnerLock("locked", async () => "released")).resolves.toBe("released");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PostgresNessieMappingStore } from "./mapping-store";

function fakePool(lockResult: boolean | Error, unlockFailure = false) {
  const release = vi.fn();
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("to_regclass")) return { rows: [{ name: "nessie_user_accounts" }] };
    if (sql.includes("pg_try_advisory_lock")) {
      if (lockResult instanceof Error) throw lockResult;
      return { rows: [{ locked: lockResult }] };
    }
    if (sql.includes("pg_advisory_unlock") && unlockFailure) throw new Error("connection lost");
    return { rows: [] };
  });
  const client = { query, release };
  const pool = { connect: async () => client } as unknown as Pool;
  return { pool, release };
}

describe("Nessie provisioning lock cleanup", () => {
  it("discards a connection after a lost lock response rather than pooling an unknown session lock", async () => {
    const { pool, release } = fakePool(new Error("read timeout"));
    await expect(new PostgresNessieMappingStore(pool).withOwnerLock("alice", async () => undefined)).rejects.toThrow("read timeout");
    expect(release).toHaveBeenLastCalledWith(true);
  });
  it("discards the connection if unlocking fails", async () => {
    const { pool, release } = fakePool(true, true);
    expect(await new PostgresNessieMappingStore(pool).withOwnerLock("alice", async () => "done")).toBe("done");
    expect(release).toHaveBeenLastCalledWith(true);
  });
  it("returns a successfully unlocked connection after the work fails", async () => {
    const { pool, release } = fakePool(true);
    await expect(new PostgresNessieMappingStore(pool).withOwnerLock("alice", async () => { throw new Error("provider failed"); })).rejects.toThrow("provider failed");
    expect(release).toHaveBeenLastCalledWith(false);
  });
});

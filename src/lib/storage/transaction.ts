import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";

interface Transaction {
  ownerId: string;
  client?: PoolClient;
  memory: Map<string, unknown>;
  rollback: (() => void)[];
  afterCommit: (() => Promise<void>)[];
}
const context = new AsyncLocalStorage<Transaction>();
const memory = new Map<string, unknown>();
const locks = new Map<string, Promise<void>>();
let pool: Pool | undefined;

export function assertStorageConfigured() {
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL && process.env.ALLOW_EPHEMERAL_DEMO !== "true") {
    throw new Error("Persistent storage is not configured. Set DATABASE_URL before serving financial data.");
  }
}

export function readMemory<T>(namespace: string, ownerId: string, initialize: () => T): T {
  const key = `${namespace}\0${ownerId}`;
  const transaction = context.getStore();
  if (transaction && transaction.ownerId !== ownerId) throw new Error("Transaction owner mismatch");
  if (transaction) {
    if (!transaction.memory.has(key)) transaction.memory.set(key, structuredClone(memory.has(key) ? memory.get(key) : initialize()));
    return transaction.memory.get(key) as T;
  }
  if (!memory.has(key)) memory.set(key, initialize());
  return memory.get(key) as T;
}

export function onTransactionRollback(callback: () => void) {
  context.getStore()?.rollback.push(callback);
}

/** Defer cross-owner side effects until the outermost transaction has committed. */
export async function afterTransactionCommit(callback: () => Promise<void>) {
  const transaction = context.getStore();
  if (transaction) transaction.afterCommit.push(callback);
  else await callback();
}

async function runAfterCommit(transaction: Transaction) {
  for (const callback of transaction.afterCommit) {
    try { await callback(); }
    catch { console.warn("[database] A post-commit notification could not be completed."); }
  }
}

export async function withDatabaseClient<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const existing = context.getStore()?.client;
  if (existing) return work(existing);
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL!);
    const localPlaintext = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.searchParams.get("sslmode") === "disable";
    url.searchParams.delete("sslmode");
    pool = new Pool({ connectionString: url.toString(), ssl: localPlaintext ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, statement_timeout: 30000 });
    pool.on("error", () => console.error("[database] An idle database connection closed unexpectedly."));
  }
  const client = await pool.connect();
  try { return await work(client); }
  finally { client.release(); }
}

/** One owner lock and one database client cover all reads and writes in an operation. */
export async function withOwnerTransaction<T>(ownerId: string, work: () => Promise<T>): Promise<T> {
  assertStorageConfigured();
  const existing = context.getStore();
  if (existing) {
    if (existing.ownerId !== ownerId) throw new Error("Transaction owner mismatch");
    return work();
  }
  if (process.env.DATABASE_URL) {
    const transaction: Transaction = { ownerId, memory: new Map(), rollback: [], afterCommit: [] };
    const result = await withDatabaseClient(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
        transaction.client = client;
        const result = await context.run(transaction, work);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
    await runAfterCommit(transaction);
    return result;
  }
  const previous = locks.get(ownerId) ?? Promise.resolve();
  let unlock!: () => void;
  const lock = new Promise<void>((resolve) => { unlock = resolve; });
  locks.set(ownerId, lock);
  await previous;
  const transaction: Transaction = { ownerId, memory: new Map(), rollback: [], afterCommit: [] };
  let result: T;
  try {
    result = await context.run(transaction, work);
    for (const [key, value] of transaction.memory) memory.set(key, structuredClone(value));
  } catch (error) {
    for (const undo of transaction.rollback.reverse()) undo();
    throw error;
  } finally {
    unlock();
    if (locks.get(ownerId) === lock) locks.delete(ownerId);
  }
  await runAfterCommit(transaction);
  return result;
}

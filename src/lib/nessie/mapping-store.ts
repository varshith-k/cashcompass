import "server-only";
import { Pool, type PoolClient } from "pg";
import { NessieProvisioningError, type MappingSession, type MappingStore, type NessieMapping } from "./provisioning";

// Also shipped as db/migrations/20261018_nessie_user_accounts.sql for DB operators.
export const NESSIE_MAPPING_DDL = `CREATE TABLE IF NOT EXISTS nessie_user_accounts (
  owner_id text PRIMARY KEY,
  provisioning_token text NOT NULL UNIQUE,
  customer_id text UNIQUE,
  account_id text UNIQUE,
  customer_attempted boolean NOT NULL DEFAULT false,
  account_attempted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (account_id IS NULL OR customer_id IS NOT NULL),
  CHECK (NOT account_attempted OR customer_id IS NOT NULL)
)`;

async function read(client: Pick<PoolClient, "query">, ownerId: string): Promise<NessieMapping | null> {
  const result = await client.query<NessieMapping>("SELECT * FROM nessie_user_accounts WHERE owner_id = $1", [ownerId]);
  return result.rows[0] ?? null;
}

/** Session advisory locks span committed checkpoints and remote requests. */
export class PostgresNessieMappingStore implements MappingStore {
  private initialization: Promise<void> | undefined;
  constructor(private readonly pool: Pool) {}

  private async ensureSchema(): Promise<void> {
    if (!this.initialization) {
      this.initialization = (async () => {
        const client = await this.pool.connect();
        let destroy = false;
        try {
          await client.query("BEGIN");
          await client.query("SET LOCAL lock_timeout = '5s'");
          await client.query("SELECT pg_advisory_xact_lock(194823, 1)");
          // Already-migrated databases work with a least-privilege runtime role.
          const existing = await client.query("SELECT to_regclass('nessie_user_accounts') AS name");
          if (!existing.rows[0].name) await client.query(NESSIE_MAPPING_DDL);
          await client.query("COMMIT");
        } catch (error) {
          try { await client.query("ROLLBACK"); } catch { destroy = true; }
          throw error;
        } finally { client.release(destroy); }
      })().catch((error) => { this.initialization = undefined; throw error; });
    }
    await this.initialization;
  }

  async get(ownerId: string): Promise<NessieMapping | null> {
    try { return await read(this.pool, ownerId); }
    catch (error) {
      if ((error as { code?: string }).code === "42P01") return null;
      throw error;
    }
  }

  async withOwnerLock<T>(ownerId: string, work: (session: MappingSession) => Promise<T>): Promise<T> {
    await this.ensureSchema();
    const client = await this.pool.connect();
    let locked = false;
    let destroy = false;
    const lockName = `cashcompass:nessie:${ownerId}`;
    try {
      const result = await client.query("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked", [lockName]);
      locked = result.rows[0].locked;
      if (!locked) throw new NessieProvisioningError("Your sandbox account is being prepared. Please retry shortly.");
      return await work({
        read: () => read(client, ownerId),
        save: async (mapping) => {
          if (mapping.owner_id !== ownerId) throw new Error("Sandbox ownership mismatch.");
          await client.query(`INSERT INTO nessie_user_accounts
            (owner_id, provisioning_token, customer_id, account_id, customer_attempted, account_attempted)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (owner_id) DO UPDATE SET customer_id = EXCLUDED.customer_id,
              account_id = EXCLUDED.account_id, customer_attempted = EXCLUDED.customer_attempted,
              account_attempted = EXCLUDED.account_attempted, updated_at = now()`,
          [ownerId, mapping.provisioning_token, mapping.customer_id, mapping.account_id, mapping.customer_attempted, mapping.account_attempted]);
        },
      });
    } finally {
      if (locked) {
        try { await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [lockName]); }
        catch { destroy = true; }
      }
      // A lost lock-query response may still have acquired the session lock.
      // Discard that connection rather than returning an unknown lock to the pool.
      client.release(destroy || !locked);
    }
  }
}

let store: PostgresNessieMappingStore | undefined;
export function getNessieMappingStore(): PostgresNessieMappingStore {
  if (!process.env.DATABASE_URL) throw new Error("Per-user sandbox accounts require DATABASE_URL for durable storage.");
  // Match the existing Tiger repository's TLS policy; keep setup queries bounded.
  if (store) return store;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 4,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  pool.on("error", () => console.warn("[nessie] database connection unavailable"));
  return store = new PostgresNessieMappingStore(pool);
}

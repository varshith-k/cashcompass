import "server-only";
import type { Pool } from "pg";

// Tables added after the first deploy are created on first use, so a server
// that hasn't re-run db/schema.sql keeps working. Same statements as there.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS friends (
     id text PRIMARY KEY,
     owner_id text NOT NULL,
     name text NOT NULL,
     email text,
     phone text,
     nessie_account_id text,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS friends_owner_name_idx ON friends (owner_id, lower(name))`,
  `CREATE TABLE IF NOT EXISTS shared_balances (
     id text PRIMARY KEY,
     from_owner_id text NOT NULL,
     from_name text NOT NULL,
     from_email text,
     to_email text NOT NULL,
     kind text NOT NULL CHECK (kind IN ('they_owe_sender', 'sender_owes')),
     amount numeric(12, 2) NOT NULL CHECK (amount > 0),
     description text NOT NULL,
     due_date timestamptz NOT NULL,
     from_event_id text NOT NULL,
     status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'settled', 'cancelled')),
     to_owner_id text,
     to_event_id text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (from_owner_id, from_event_id)
   )`,
  `CREATE INDEX IF NOT EXISTS shared_balances_to_email_idx ON shared_balances (to_email, status)`,
];

let ready: Promise<void> | null = null;

export function ensureAppTables(pool: Pool): Promise<void> {
  ready ??= (async () => {
    for (const sql of STATEMENTS) await pool.query(sql);
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

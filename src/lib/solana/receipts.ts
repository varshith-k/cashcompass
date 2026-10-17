import "server-only";
import { Pool } from "pg";

const claimed = new Set<string>();
let pool: Pool | undefined;

/** Reserve a signature once across users. Database mode survives process restarts. */
export async function claimSettlement(signature: string, ownerId: string, entryId: string): Promise<boolean> {
  if (process.env.DATABASE_URL) {
    pool ??= new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query("INSERT INTO solana_settlement_receipts (signature, owner_id, entry_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING signature", [signature, ownerId, entryId]);
    return result.rowCount === 1;
  }
  if (claimed.has(signature)) return false;
  claimed.add(signature);
  return true;
}

export async function releaseSettlement(signature: string, ownerId: string) {
  if (process.env.DATABASE_URL) {
    await pool?.query("DELETE FROM solana_settlement_receipts WHERE signature = $1 AND owner_id = $2", [signature, ownerId]);
  } else claimed.delete(signature);
}

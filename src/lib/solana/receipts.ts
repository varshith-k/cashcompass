import "server-only";
import { onTransactionRollback, withDatabaseClient } from "@/lib/storage/transaction";
const claimed = new Map<string, string>();

/** Uses the ledger transaction's database client, so receipt and repayment commit together. */
export async function claimSettlement(signature: string, ownerId: string, entryId: string): Promise<boolean> {
  if (process.env.DATABASE_URL) {
    return withDatabaseClient(async (client) => {
      const result = await client.query("INSERT INTO solana_settlement_receipts (signature, owner_id, entry_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING signature", [signature, ownerId, entryId]);
      return result.rowCount === 1;
    });
  }
  if (claimed.has(signature)) return false;
  claimed.set(signature, ownerId);
  onTransactionRollback(() => { if (claimed.get(signature) === ownerId) claimed.delete(signature); });
  return true;
}
export async function releaseSettlement(signature: string, ownerId: string) {
  if (process.env.DATABASE_URL) {
    await withDatabaseClient((client) => client.query("DELETE FROM solana_settlement_receipts WHERE signature = $1 AND owner_id = $2", [signature, ownerId]));
  } else if (claimed.get(signature) === ownerId) claimed.delete(signature);
}

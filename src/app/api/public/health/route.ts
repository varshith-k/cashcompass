import { connection } from "next/server";
import { isAuth0Configured } from "@/lib/auth/config";
import { withDatabaseClient } from "@/lib/storage/transaction";

/** Public readiness and build identity. Never exposes environment values or database errors. */
export async function GET() {
  await connection();
  let ready = isAuth0Configured() && Boolean(process.env.DATABASE_URL);
  if (ready) {
    try {
      ready = await withDatabaseClient(async (client) => {
        const result = await client.query("SELECT to_regclass('financial_events') IS NOT NULL AND to_regclass('planning_profiles') IS NOT NULL AND to_regclass('nessie_user_accounts') IS NOT NULL AND to_regclass('solana_settlement_receipts') IS NOT NULL AND (SELECT count(*) = 3 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'financial_events' AND column_name IN ('owner_id', 'counterparty_phone', 'source_record_id')) AS ready");
        return result.rows[0].ready === true;
      });
    } catch { ready = false; }
  }
  // Existing systemd installers encode the revision in the release directory.
  const releaseRevision = process.cwd().match(/\/releases\/\d{8}T\d{6}Z-([a-f0-9]{12})$/)?.[1];
  const revision = /^[a-f0-9]{40}$/.test(process.env.CASHCOMPASS_BUILD_SHA ?? "") ? process.env.CASHCOMPASS_BUILD_SHA : releaseRevision ?? "unknown";
  return Response.json({ status: ready ? "ready" : "not_ready", revision }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

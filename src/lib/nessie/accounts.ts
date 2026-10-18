import "server-only";
import { requireSession } from "@/lib/auth/session";
import { getAccount, isNessieConfigured, type NessieAccount } from "./client";
import { getNessieMappingStore } from "./mapping-store";

/** Read only; never creates an account during a render or prefetch. */
export async function listUserAccounts(): Promise<{ accounts: NessieAccount[]; error?: string }> {
  const session = await requireSession();
  if (!isNessieConfigured()) return { accounts: [] };
  if (session.source !== "auth0") return { accounts: [], error: "Sign in with Auth0 to use your own Nessie sandbox account." };
  if (!process.env.DATABASE_URL) return { accounts: [], error: "Per-user sandbox accounts require DATABASE_URL for durable storage." };
  try {
    const mapping = await getNessieMappingStore().get(session.user.id);
    if (!mapping?.account_id || !mapping.customer_id) return { accounts: [] };
    const account = await getAccount(mapping.account_id);
    if (account._id !== mapping.account_id || account.customer_id !== mapping.customer_id) {
      return { accounts: [], error: "Sandbox account ownership could not be verified. Contact the administrator." };
    }
    return { accounts: [account] };
  } catch { return { accounts: [], error: "Unable to load your sandbox account. Check the connection and retry." }; }
}

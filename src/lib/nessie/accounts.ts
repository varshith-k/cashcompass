import "server-only";
import { getAccount, getAccountsForCustomer, isNessieConfigured, type NessieAccount } from "./client";

/** Only configured sandbox accounts are selectable; no account id is trusted from the browser. */
export async function listDemoAccounts(): Promise<{ accounts: NessieAccount[]; error?: string }> {
  if (!isNessieConfigured()) return { accounts: [] };
  try {
    if (process.env.NESSIE_CUSTOMER_ID) return { accounts: await getAccountsForCustomer(process.env.NESSIE_CUSTOMER_ID) };
    if (process.env.NESSIE_ACCOUNT_ID) return { accounts: [await getAccount(process.env.NESSIE_ACCOUNT_ID)] };
    return { accounts: [], error: "Set NESSIE_CUSTOMER_ID or NESSIE_ACCOUNT_ID to select a sandbox account." };
  } catch { return { accounts: [], error: "Unable to load Nessie demo accounts. Check the configuration and retry." }; }
}

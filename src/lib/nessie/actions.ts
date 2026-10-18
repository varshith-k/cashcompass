"use server";

import { revalidatePath } from "next/cache";
import { requireSession, requireOwnerId } from "@/lib/auth/session";
import { isNessieConfigured } from "./client";
import { syncNessieAccount } from "./sync";
import { listUserAccounts } from "./accounts";
import { recordSyncStatus } from "./status";
import { getNessieMappingStore } from "./mapping-store";
import { NessieProvisioningError, provisionUserAccount } from "./provisioning";
import { getFriends } from "@/lib/finance/friends";

export async function syncNessie(selectedAccountId?: string) {
  const ownerId = await requireOwnerId();
  if (!isNessieConfigured()) {
    return { ok: false as const, message: "Add NESSIE_API_KEY in your environment to sync real demo data." };
  }
  const { accounts, error } = await listUserAccounts();
  if (error) return { ok: false as const, message: error };
  const accountId = selectedAccountId || accounts[0]?._id;
  if (!accountId || !accounts.some((account) => account._id === accountId)) {
    return { ok: false as const, message: "Choose your own sandbox account in Settings." };
  }

  try {
    const result = await syncNessieAccount(accountId, { friends: getFriends(ownerId) });
    recordSyncStatus(ownerId, result);
    revalidatePath("/", "layout");
    return { ok: true as const, ...result };
  } catch {
    return { ok: false as const, message: "Unable to sync your sandbox account. Please retry when the connection is available." };
  }
}

/** Existing users can provision/recover without signing out; the browser supplies no owner id. */
export async function setupNessieAccount() {
  const session = await requireSession();
  if (session.source !== "auth0") return { ok: false as const, message: "Sign in with Auth0 to create your sandbox account." };
  if (!isNessieConfigured() || !process.env.DATABASE_URL) return { ok: false as const, message: "The administrator must configure NESSIE_API_KEY and DATABASE_URL first." };
  try {
    await provisionUserAccount(session.user.id, getNessieMappingStore());
    const { accounts, error } = await listUserAccounts();
    if (error || accounts.length === 0) return { ok: false as const, message: error ?? "Your sandbox account could not be verified. Please retry." };
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Your own sandbox checking account is ready. It starts at $0; no real money is involved." };
  } catch (error) {
    return { ok: false as const, message: error instanceof NessieProvisioningError ? error.message : "Unable to prepare your sandbox account. Retry to check its status." };
  }
}

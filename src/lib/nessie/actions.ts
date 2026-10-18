"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerId } from "@/lib/auth/session";
import { isNessieConfigured } from "./client";
import { syncNessieAccount } from "./sync";
import { listDemoAccounts } from "./accounts";
import { recordSyncStatus } from "./status";
import { getFriends } from "@/lib/finance/friends";

export async function syncNessie(selectedAccountId?: string) {
  // Each user syncs the shared demo account into their own records
  // (repository writes are scoped to the session user).
  const ownerId = await requireOwnerId();
  if (!isNessieConfigured()) {
    return { ok: false as const, message: "Add NESSIE_API_KEY in your environment to sync real demo data." };
  }
  const { accounts, error } = await listDemoAccounts();
  if (error) return { ok: false as const, message: error };
  const accountId = selectedAccountId || process.env.NESSIE_ACCOUNT_ID || accounts[0]?._id;
  if (!accountId || !accounts.some((account) => account._id === accountId)) {
    return { ok: false as const, message: "Set NESSIE_ACCOUNT_ID to choose which demo account to sync." };
  }

  try {
    const result = await syncNessieAccount(accountId, { friends: getFriends(ownerId) });
    recordSyncStatus(ownerId, result);
    revalidatePath("/", "layout");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Sync failed." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerId } from "@/lib/auth/session";
import { isNessieConfigured } from "./client";
import { syncNessieAccount } from "./sync";
import { recordSyncStatus } from "./status";

export async function syncNessie() {
  // Each user syncs the shared demo account into their own records
  // (repository writes are scoped to the session user).
  const ownerId = await requireOwnerId();
  if (!isNessieConfigured()) {
    return { ok: false as const, message: "Add NESSIE_API_KEY in your environment to sync real demo data." };
  }
  const accountId = process.env.NESSIE_ACCOUNT_ID;
  if (!accountId) {
    return { ok: false as const, message: "Set NESSIE_ACCOUNT_ID to choose which demo account to sync." };
  }

  try {
    const result = await syncNessieAccount(accountId);
    recordSyncStatus(ownerId, result);
    revalidatePath("/transactions");
    revalidatePath("/bills");
    revalidatePath("/overview");
    revalidatePath("/settings");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Sync failed." };
  }
}

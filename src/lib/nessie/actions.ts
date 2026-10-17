"use server";

import { revalidatePath } from "next/cache";
import { isNessieConfigured } from "./client";
import { syncNessieAccount } from "./sync";
import { recordSyncStatus } from "./status";

export async function syncNessie() {
  if (!isNessieConfigured()) {
    return { ok: false as const, message: "Add NESSIE_API_KEY in your environment to sync real demo data." };
  }
  const accountId = process.env.NESSIE_ACCOUNT_ID;
  if (!accountId) {
    return { ok: false as const, message: "Set NESSIE_ACCOUNT_ID to choose which demo account to sync." };
  }

  try {
    const result = await syncNessieAccount(accountId);
    recordSyncStatus(result);
    revalidatePath("/transactions");
    revalidatePath("/bills");
    revalidatePath("/overview");
    revalidatePath("/settings");
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Sync failed." };
  }
}

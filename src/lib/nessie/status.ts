import "server-only";
import { getPlanningProfile, updatePlanningProfile } from "@/lib/storage/profile";
export interface SyncStatus {
  timestamp: string; added: number; skipped: number; updated?: number;
  accountId?: string; accountName?: string; accountBalance?: number;
}
export async function recordSyncStatus(ownerId: string, result: Omit<SyncStatus, "timestamp">) {
  await updatePlanningProfile(ownerId, (profile) => { profile.syncStatus = { timestamp: new Date().toISOString(), ...result }; });
}
export async function getSyncStatus(ownerId: string): Promise<SyncStatus | null> {
  return (await getPlanningProfile(ownerId)).syncStatus;
}

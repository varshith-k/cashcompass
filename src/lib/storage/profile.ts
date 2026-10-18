import "server-only";
import type { BudgetAllocation } from "@/lib/finance/budgets";
import type { WishlistGoal } from "@/lib/finance/wishlist-goals";
import type { SyncStatus } from "@/lib/nessie/status";
import { assertStorageConfigured, readMemory, withDatabaseClient, withOwnerTransaction } from "./transaction";

export interface AccountSnapshot {
  balance: number;
  timestamp: string;
  /** Posted imported amounts already reflected in this account balance. */
  reflectedEvents: Record<string, number>;
}
export interface PlanningProfile {
  budgets: BudgetAllocation[];
  goals: WishlistGoal[];
  syncStatus: SyncStatus | null;
  accountSnapshots: Record<string, AccountSnapshot>;
  openingBalance: number | null;
}
function defaults(): PlanningProfile {
  const target = new Date(); target.setUTCDate(target.getUTCDate() + 70);
  return {
    budgets: [{ category: "Housing", monthlyLimit: 1300 }, { category: "Groceries", monthlyLimit: 400 }, { category: "Dining", monthlyLimit: 150 }, { category: "Transportation", monthlyLimit: 150 }, { category: "Subscriptions", monthlyLimit: 40 }, { category: "Utilities", monthlyLimit: 150 }],
    goals: process.env.DATABASE_URL ? [] : [{ id: "goal-miami", name: "Miami Trip Goal", targetAmount: 900, targetDate: target.toISOString() }],
    syncStatus: null, accountSnapshots: {}, openingBalance: null,
  };
}
export async function getPlanningProfile(ownerId: string): Promise<PlanningProfile> {
  assertStorageConfigured();
  if (!process.env.DATABASE_URL) return structuredClone(readMemory("profile", ownerId, defaults));
  return withDatabaseClient(async (client) => {
    await client.query("INSERT INTO planning_profiles (owner_id, data) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING", [ownerId, JSON.stringify(defaults())]);
    const result = await client.query<{ data: PlanningProfile }>("SELECT data FROM planning_profiles WHERE owner_id = $1", [ownerId]);
    return { ...defaults(), ...result.rows[0].data };
  });
}
export async function updatePlanningProfile<T>(ownerId: string, work: (profile: PlanningProfile) => T | Promise<T>): Promise<T> {
  return withOwnerTransaction(ownerId, async () => {
    const profile = await getPlanningProfile(ownerId);
    const result = await work(profile);
    if (process.env.DATABASE_URL) {
      await withDatabaseClient((client) => client.query("UPDATE planning_profiles SET data = $2::jsonb, updated_at = now() WHERE owner_id = $1", [ownerId, JSON.stringify(profile)]));
    } else Object.assign(readMemory("profile", ownerId, defaults), profile);
    return result;
  });
}

import "server-only";
import { getPlanningProfile, updatePlanningProfile } from "@/lib/storage/profile";
export interface BudgetAllocation { category: string; monthlyLimit: number }
export async function getBudgets(ownerId: string): Promise<BudgetAllocation[]> {
  return (await getPlanningProfile(ownerId)).budgets;
}
export async function setBudgetLimits(ownerId: string, limits: Record<string, number>) {
  await updatePlanningProfile(ownerId, (profile) => {
    for (const budget of profile.budgets) {
      const limit = limits[budget.category];
      if (limit === undefined) continue;
      if (!Number.isFinite(limit) || limit < 0 || limit > 9999999999.99) throw new Error("Invalid budget limit");
      budget.monthlyLimit = Math.round(limit * 100) / 100;
    }
  });
}

import "server-only";

export interface BudgetAllocation {
  category: string;
  monthlyLimit: number;
}

/**
 * Per user (keyed by Auth0 `sub`). In-memory for now, same caveat as demo-repository.ts: persists for the
 * server process's lifetime, not durably. Durable budget storage is a
 * production extension even when financial events use Tiger Data — see src/lib/finance/README.md.
 */
const DEFAULT_BUDGETS: BudgetAllocation[] = [
  { category: "Housing", monthlyLimit: 1300 },
  { category: "Groceries", monthlyLimit: 400 },
  { category: "Dining", monthlyLimit: 150 },
  { category: "Transportation", monthlyLimit: 150 },
  { category: "Subscriptions", monthlyLimit: 40 },
  { category: "Utilities", monthlyLimit: 150 },
];

const stores = new Map<string, BudgetAllocation[]>();

function storeFor(ownerId: string) {
  let budgets = stores.get(ownerId);
  if (!budgets) {
    budgets = DEFAULT_BUDGETS.map((budget) => ({ ...budget }));
    stores.set(ownerId, budgets);
  }
  return budgets;
}

export function getBudgets(ownerId: string): BudgetAllocation[] {
  return storeFor(ownerId);
}

export function setBudgetLimits(ownerId: string, limits: Record<string, number>) {
  const budgets = storeFor(ownerId);
  for (const budget of budgets) {
    if (limits[budget.category] !== undefined) {
      budget.monthlyLimit = limits[budget.category];
    }
  }
}

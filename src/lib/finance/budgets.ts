import "server-only";

export interface BudgetAllocation {
  category: string;
  monthlyLimit: number;
}

/**
 * In-memory for now, same caveat as demo-repository.ts: persists for the
 * server process's lifetime, not durably. A real budgets table is a
 * Phase 5 addition once Tiger Data is live — see src/lib/finance/README.md.
 */
const DEFAULT_BUDGETS: BudgetAllocation[] = [
  { category: "Housing", monthlyLimit: 1300 },
  { category: "Groceries", monthlyLimit: 400 },
  { category: "Dining", monthlyLimit: 150 },
  { category: "Transportation", monthlyLimit: 150 },
  { category: "Subscriptions", monthlyLimit: 40 },
  { category: "Utilities", monthlyLimit: 150 },
];

let store: BudgetAllocation[] | null = null;

function ensureStore() {
  if (!store) {
    store = DEFAULT_BUDGETS.map((budget) => ({ ...budget }));
  }
  return store;
}

export function getBudgets(): BudgetAllocation[] {
  return ensureStore();
}

export function setBudgetLimits(limits: Record<string, number>) {
  const budgets = ensureStore();
  for (const budget of budgets) {
    if (limits[budget.category] !== undefined) {
      budget.monthlyLimit = limits[budget.category];
    }
  }
}

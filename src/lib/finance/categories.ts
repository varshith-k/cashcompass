export const EXPENSE_CATEGORIES = [
  "Housing",
  "Utilities",
  "Groceries",
  "Dining",
  "Transportation",
  "Subscriptions",
  "Credit card",
  "Savings",
  "Other",
] as const;

export const INCOME_CATEGORIES = ["Payroll", "Repayment", "Other"] as const;

export const ALL_CATEGORIES = Array.from(
  new Set<string>([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]),
);

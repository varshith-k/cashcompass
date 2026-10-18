import type { EXPENSE_CATEGORIES } from "@/lib/finance/categories";

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// Checked in order; the first category whose keywords appear wins.
const RULES: [ExpenseCategory, RegExp][] = [
  ["Credit card", /\b(credit card|card payment|card services|visa|mastercard|amex|american express|discover card)\b/i],
  ["Housing", /\b(rent|apartment|apartments|landlord|mortgage|housing|property|lease)\b/i],
  ["Utilities", /\b(electric|energy|power|water|gas company|utility|utilities|internet|wifi|comcast|xfinity|verizon|at&t|t-mobile|phone|wireless|sewer|trash)\b/i],
  ["Subscriptions", /\b(netflix|spotify|hulu|disney|youtube|prime|subscription|membership|apple music|icloud|patreon)\b/i],
  ["Groceries", /\b(grocery|groceries|supermarket|market|publix|kroger|trader joe|whole foods|aldi|safeway|walmart|costco|food lion)\b/i],
  ["Dining", /\b(restaurant|cafe|coffee|starbucks|pizza|burger|grill|diner|bar|taco|chipotle|mcdonald|subway|food|dining|bakery)\b/i],
  ["Transportation", /\b(gas station|fuel|shell|exxon|chevron|bp|uber|lyft|transit|parking|toll|airline|auto|car|metro|bus)\b/i],
];

/**
 * Best-effort category for an imported Nessie expense, from the merchant's
 * own category tags (when Nessie provides them) and its name/description.
 * Falls back to "Other" rather than guessing, so imported spending lines up
 * with budgets where it can and never lands in a wrong specific category.
 */
export function categorizeExpense(...texts: (string | string[] | undefined | null)[]): ExpenseCategory {
  const haystack = texts.flat().filter(Boolean).join(" ");
  for (const [category, pattern] of RULES) {
    if (pattern.test(haystack)) return category;
  }
  return "Other";
}

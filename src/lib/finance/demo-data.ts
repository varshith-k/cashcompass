import type { FinancialEvent } from "./types";

function isoDaysFromToday(offset: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString();
}

export const DEMO_PREFERRED_BUFFER = 300;

/**
 * The demo account's available balance today. Chosen so the flagship demo
 * question works: $2,250 looks like plenty for a $1,200 laptop, but rent
 * ($1,250) is due before the next paycheck, so buying today puts rent at
 * risk while buying after payday stays above the buffer.
 */
const DEMO_TODAY_BALANCE = 2250;

type DemoEventTemplate = Omit<FinancialEvent, "date"> & { dayOffset: number };

function spend(id: string, dayOffset: number, amount: number, category: string, counterparty: string): DemoEventTemplate {
  return { id, dayOffset, amount, direction: "expense", record: "actual", certainty: "certain", recurrence: "one-time", source: "manual", category, counterparty };
}

/**
 * Seed events for the demo account, as day-offsets from "today" rather than
 * fixed dates, so the dashboard and forecast always look current no matter
 * when the demo runs. All are labeled manual: none came from Capital One
 * Nessie (Nessie records only appear after a real sync). Call
 * `getDemoEvents()` to materialize real dates; never read dates from a
 * module-level constant, since that would freeze "today" at server start.
 */
const DEMO_EVENT_TEMPLATES: DemoEventTemplate[] = [
  // Last month: rent and paycheck.
  { id: "evt-rent-paid", dayOffset: -25, amount: 1250, direction: "expense", record: "actual", certainty: "certain", recurrence: "recurring", source: "manual", category: "Housing", counterparty: "Lakeview Apartments" },
  { id: "evt-paycheck-last", dayOffset: -18, amount: 1850, direction: "income", record: "actual", certainty: "certain", recurrence: "recurring", source: "manual", category: "Payroll", counterparty: "Horizon Labs Inc." },

  // Everyday spending over the last two weeks (about $30/day). The forecast
  // estimates future everyday spending from these.
  spend("evt-groceries-1", -14, 72.15, "Groceries", "Publix"),
  spend("evt-dining-1", -12, 18.4, "Dining", "Chipotle"),
  spend("evt-gas-1", -11, 38.6, "Transportation", "Shell"),
  spend("evt-dining-2", -9, 24.75, "Dining", "Satchel's Pizza"),
  spend("evt-groceries-2", -8, 64.3, "Groceries", "Trader Joe's"),
  spend("evt-other-1", -7, 27.99, "Other", "Target"),
  spend("evt-coffee-1", -5, 6.5, "Dining", "Local Grind Coffee"),
  spend("evt-rideshare", -4, 12.8, "Transportation", "Uber"),
  spend("evt-groceries-3", -3, 58.9, "Groceries", "Publix"),
  spend("evt-dining-3", -2, 22.1, "Dining", "Krishna Lunch"),
  spend("evt-groceries-4", -1, 41.25, "Groceries", "Trader Joe's"),
  spend("evt-coffee", -1, 6.5, "Dining", "Local Grind Coffee"),
  spend("evt-gas", 0, 41.2, "Transportation", "Shell"),

  // Coming up before the next paycheck.
  { id: "evt-utilities", dayOffset: 4, amount: 118.3, direction: "expense", record: "planned", certainty: "certain", recurrence: "recurring", source: "manual", category: "Utilities", counterparty: "Duke Energy" },
  { id: "evt-rent-next", dayOffset: 5, amount: 1250, direction: "expense", record: "planned", certainty: "certain", recurrence: "recurring", source: "manual", category: "Housing", counterparty: "Lakeview Apartments" },
  { id: "evt-streaming", dayOffset: 6, amount: 15.99, direction: "expense", record: "planned", certainty: "certain", recurrence: "recurring", source: "manual", category: "Subscriptions", counterparty: "Netflix" },
  { id: "evt-owe-alex", dayOffset: 8, amount: 60, direction: "expense", record: "planned", certainty: "certain", recurrence: "one-time", source: "manual", category: "Repayment", counterparty: "Alex (concert tickets)" },
  { id: "evt-roommate-repayment", dayOffset: 9, amount: 180, direction: "income", record: "planned", certainty: "uncertain", recurrence: "one-time", source: "manual", category: "Repayment", counterparty: "Sam (roommate)", counterpartyPhone: "+15555550123" },
  { id: "evt-phone-bill", dayOffset: 11, amount: 65, direction: "expense", record: "planned", certainty: "certain", recurrence: "recurring", source: "manual", category: "Utilities", counterparty: "Verizon" },

  // Next paycheck, then savings toward the wishlist goal.
  { id: "evt-paycheck-next", dayOffset: 12, amount: 1850, direction: "income", record: "planned", certainty: "certain", recurrence: "recurring", source: "manual", category: "Payroll", counterparty: "Horizon Labs Inc." },
  { id: "evt-savings-wishlist", dayOffset: 13, amount: 75, direction: "expense", record: "planned", certainty: "certain", recurrence: "recurring", source: "manual", category: "Savings", counterparty: "Miami Trip Goal" },
];

/** Opening balance that makes today's available balance DEMO_TODAY_BALANCE. */
export const DEMO_STARTING_BALANCE =
  Math.round(
    (DEMO_TODAY_BALANCE -
      DEMO_EVENT_TEMPLATES.filter((t) => t.record === "actual" && t.dayOffset <= 0).reduce(
        (sum, t) => sum + (t.direction === "income" ? t.amount : -t.amount),
        0,
      )) *
      100,
  ) / 100;

export function getDemoEvents(): FinancialEvent[] {
  return DEMO_EVENT_TEMPLATES.map(({ dayOffset, ...template }) => ({
    ...template,
    date: isoDaysFromToday(dayOffset),
  }));
}

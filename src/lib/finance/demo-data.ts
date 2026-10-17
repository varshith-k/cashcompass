import type { FinancialEvent } from "./types";

function isoDaysFromToday(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString();
}

export const DEMO_STARTING_BALANCE = 3842.17;
export const DEMO_PREFERRED_BUFFER = 300;

type DemoEventTemplate = Omit<FinancialEvent, "date"> & { dayOffset: number };

/**
 * Seed events for the demo account, as day-offsets from "today" rather than
 * fixed dates, so the dashboard and forecast always look current no matter
 * when the demo runs. Mirrors what a mix of manual entries and Capital One
 * Nessie demo records would produce. Call `getDemoEvents()` to materialize
 * these into real dates — never read dates from a module-level constant,
 * since that would freeze "today" at whenever the server process started.
 */
const DEMO_EVENT_TEMPLATES: DemoEventTemplate[] = [
  {
    id: "evt-paycheck-last",
    dayOffset: -3,
    amount: 1650,
    direction: "income",
    record: "actual",
    certainty: "certain",
    recurrence: "recurring",
    source: "nessie",
    category: "Payroll",
    counterparty: "Horizon Labs Inc.",
  },
  {
    id: "evt-rent-paid",
    dayOffset: -2,
    amount: 1250,
    direction: "expense",
    record: "actual",
    certainty: "certain",
    recurrence: "recurring",
    source: "nessie",
    category: "Housing",
    counterparty: "Lakeview Apartments",
  },
  {
    id: "evt-groceries-1",
    dayOffset: -1,
    amount: 86.42,
    direction: "expense",
    record: "actual",
    certainty: "certain",
    recurrence: "one-time",
    source: "nessie",
    category: "Groceries",
    counterparty: "Trader Joe's",
  },
  {
    id: "evt-coffee",
    dayOffset: -1,
    amount: 6.5,
    direction: "expense",
    record: "actual",
    certainty: "certain",
    recurrence: "one-time",
    source: "manual",
    category: "Dining",
    counterparty: "Local Grind Coffee",
  },
  {
    id: "evt-gas",
    dayOffset: 0,
    amount: 41.2,
    direction: "expense",
    record: "actual",
    certainty: "certain",
    recurrence: "one-time",
    source: "nessie",
    category: "Transportation",
    counterparty: "Shell",
  },
  {
    id: "evt-utilities",
    dayOffset: 4,
    amount: 118.3,
    direction: "expense",
    record: "planned",
    certainty: "certain",
    recurrence: "recurring",
    source: "manual",
    category: "Utilities",
    counterparty: "Duke Energy",
  },
  {
    id: "evt-streaming",
    dayOffset: 6,
    amount: 15.99,
    direction: "expense",
    record: "planned",
    certainty: "certain",
    recurrence: "recurring",
    source: "manual",
    category: "Subscriptions",
    counterparty: "Netflix",
  },
  {
    id: "evt-roommate-repayment",
    dayOffset: 9,
    amount: 180,
    direction: "income",
    record: "planned",
    certainty: "uncertain",
    recurrence: "one-time",
    source: "manual",
    category: "Repayment",
    counterparty: "Sam (roommate)",
  },
  {
    id: "evt-phone-bill",
    dayOffset: 11,
    amount: 65,
    direction: "expense",
    record: "planned",
    certainty: "certain",
    recurrence: "recurring",
    source: "manual",
    category: "Utilities",
    counterparty: "Verizon",
  },
  {
    id: "evt-paycheck-next",
    dayOffset: 12,
    amount: 1650,
    direction: "income",
    record: "planned",
    certainty: "certain",
    recurrence: "recurring",
    source: "nessie",
    category: "Payroll",
    counterparty: "Horizon Labs Inc.",
  },
  {
    id: "evt-rent-next",
    dayOffset: 16,
    amount: 1250,
    direction: "expense",
    record: "planned",
    certainty: "certain",
    recurrence: "recurring",
    source: "manual",
    category: "Housing",
    counterparty: "Lakeview Apartments",
  },
  {
    id: "evt-savings-wishlist",
    dayOffset: 13,
    amount: 75,
    direction: "expense",
    record: "planned",
    certainty: "certain",
    recurrence: "recurring",
    source: "manual",
    category: "Savings",
    counterparty: "Miami Trip Goal",
  },
];

export function getDemoEvents(): FinancialEvent[] {
  return DEMO_EVENT_TEMPLATES.map(({ dayOffset, ...template }) => ({
    ...template,
    date: isoDaysFromToday(dayOffset),
  }));
}

export function getDemoUpcomingBills(events: FinancialEvent[] = getDemoEvents()) {
  return events
    .filter(
      (event) =>
        event.direction === "expense" &&
        event.record === "planned" &&
        event.category !== "Savings",
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getDemoRecentTransactions(events: FinancialEvent[] = getDemoEvents()) {
  return events.filter((event) => event.record === "actual").sort((a, b) => b.date.localeCompare(a.date));
}

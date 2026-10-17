import { selectUpcomingBills } from "./calculations";
import type { FinancialEvent } from "./types";
import { daysUntil, formatCurrency, formatRelativeDay } from "@/lib/format";

export interface Reminder {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "overdue" | "soon" | "info";
}

/** How far ahead the notification bell looks. */
export const REMINDER_WINDOW_DAYS = 7;

/**
 * Notification-bell items: unpaid bills that are overdue or due within the
 * window, then repayments people owe the user that are due within it.
 * Pure, so it can run on the server per request and be unit-tested.
 */
export function buildReminders(events: FinancialEvent[]): Reminder[] {
  const bills = selectUpcomingBills(events)
    .filter((bill) => daysUntil(bill.date) <= REMINDER_WINDOW_DAYS)
    .map<Reminder>((bill) => {
      const overdue = daysUntil(bill.date) < 0;
      return {
        id: bill.id,
        title: `${bill.counterparty} ${formatCurrency(bill.amount, { cents: true })}`,
        detail: overdue ? "Overdue" : `Due ${formatRelativeDay(bill.date).toLowerCase()}`,
        href: "/bills",
        tone: overdue ? "overdue" : "soon",
      };
    });

  const repayments = events
    .filter(
      (event) =>
        event.category === "Repayment" &&
        event.direction === "income" &&
        event.record === "planned" &&
        daysUntil(event.date) <= REMINDER_WINDOW_DAYS,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map<Reminder>((event) => ({
      id: event.id,
      title: `${event.counterparty} owes you ${formatCurrency(event.amount, { cents: true })}`,
      detail: daysUntil(event.date) < 0 ? "Repayment is late" : `Expected ${formatRelativeDay(event.date).toLowerCase()}`,
      href: "/ledger",
      tone: "info",
    }));

  return [...bills, ...repayments];
}

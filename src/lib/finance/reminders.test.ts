import { describe, expect, it } from "vitest";

import { buildReminders } from "@/lib/finance/reminders";
import type { FinancialEvent } from "@/lib/finance/types";

function daysFromToday(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function event(overrides: Partial<FinancialEvent>): FinancialEvent {
  return {
    id: crypto.randomUUID(),
    date: daysFromToday(0),
    amount: 50,
    direction: "expense",
    record: "planned",
    certainty: "certain",
    recurrence: "one-time",
    source: "manual",
    category: "Utilities",
    counterparty: "Power Co",
    ...overrides,
  };
}

describe("buildReminders", () => {
  it("lists overdue and due-this-week bills, then repayments, and skips the rest", () => {
    const reminders = buildReminders([
      event({ counterparty: "Rent", date: daysFromToday(3), category: "Housing" }),
      event({ counterparty: "Phone", date: daysFromToday(-2) }),
      event({ counterparty: "Far bill", date: daysFromToday(20) }),
      event({ counterparty: "Paid bill", record: "actual" }),
      event({ counterparty: "Savings", category: "Savings" }),
      event({ counterparty: "Sam", category: "Repayment", direction: "income", certainty: "uncertain", date: daysFromToday(2) }),
    ]);

    expect(reminders.map((r) => r.title.split(" ")[0])).toEqual(["Phone", "Rent", "Sam"]);
    expect(reminders[0]).toMatchObject({ tone: "overdue", detail: "Overdue", href: "/bills" });
    expect(reminders[1]).toMatchObject({ tone: "soon", href: "/bills" });
    expect(reminders[2]).toMatchObject({ tone: "info", href: "/ledger" });
    expect(reminders[2]!.title).toContain("owes you");
  });

  it("is empty when nothing is due", () => {
    expect(buildReminders([event({ date: daysFromToday(30) })])).toEqual([]);
  });
});

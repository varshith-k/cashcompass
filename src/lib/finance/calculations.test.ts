import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeAvailableBalance, computeForecast, computeSafeToSpend, savingsProgressForGoal, selectUpcomingBills, spendByCategoryThisMonth } from "./calculations";
import { nextMonthlyDate } from "./dates";
import type { FinancialEvent } from "./types";

const event = (patch: Partial<FinancialEvent> = {}): FinancialEvent => ({ id: "e", date: "2026-10-20T00:00:00.000Z", amount: 100, direction: "expense", record: "planned", certainty: "certain", recurrence: "one-time", source: "manual", category: "Utilities", counterparty: "Test bill", ...patch });
const forecast = (events: FinancialEvent[], days = 35, startDate = new Date("2026-10-17T00:00:00Z")) => computeForecast(1000, events, { days, startDate, lowBalanceThreshold: 300 });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-17T18:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("financial calculations", () => {
  it("never counts planned income or subtracts unpaid bills from available funds", () => {
    const events = [event({ date: "2026-10-17", direction: "income", amount: 500 }), event({ date: "2026-10-17", amount: 100 }), event({ record: "actual", date: "2026-10-17", amount: 25 }), event({ record: "actual", date: "2026-10-18", amount: 1000 })];
    expect(computeAvailableBalance(1000, events)).toBe(975);
  });
  it("holds bills, savings and buffer back from Safe to Spend", () => {
    expect(computeSafeToSpend({ availableBalance: 1000, upcomingBills: 400, savingsEarmarks: 100, preferredBuffer: 300 }).safeToSpend).toBe(200);
    expect(computeSafeToSpend({ availableBalance: 50, upcomingBills: 400, savingsEarmarks: 100, preferredBuffer: 300 }).safeToSpend).toBe(0);
  });
  it("includes actual history before the chart window", () => {
    expect(forecast([event({ date: "2026-09-01", record: "actual", amount: 25 })])[0].projectedBalance).toBe(975);
  });
  it("does not mutate the supplied forecast start date", () => {
    const start = new Date("2026-10-17T23:30:00Z");
    forecast([], 2, start);
    expect(start.toISOString()).toBe("2026-10-17T23:30:00.000Z");
  });
  it("distinguishes uncertain income and flags risk without it", () => {
    const points = forecast([event({ date: "2026-10-18", amount: 800 }), event({ date: "2026-10-18", direction: "income", amount: 600, certainty: "uncertain" })]);
    expect(points[1]).toMatchObject({ projectedBalance: 800, conservativeBalance: 200, isLowBalanceRisk: true });
  });
  it("carries overdue obligations forward without assuming late income arrived", () => {
    const points = forecast([event({ date: "2026-10-10", amount: 120 }), event({ date: "2026-10-10", direction: "income", amount: 500, certainty: "uncertain" })]);
    expect(points[0].projectedBalance).toBe(880);
  });
  it("repeats a monthly bill through the horizon", () => {
    const points = forecast([event({ date: "2026-10-20", recurrence: "recurring" })]);
    expect(points.find((p) => p.date === "2026-11-20")?.projectedBalance).toBe(800);
  });
  it("does not repeat actual bills or weekly savings events", () => {
    expect(forecast([event({ record: "actual", recurrence: "recurring" })]).at(-1)?.projectedBalance).toBe(900);
    expect(forecast([event({ category: "Savings", recurrence: "recurring" })]).at(-1)?.projectedBalance).toBe(900);
  });
  it("clamps monthly renewals at month end without drifting the original anchor", () => {
    expect(nextMonthlyDate("2026-01-31")).toBe("2026-02-28T00:00:00.000Z");
    expect(nextMonthlyDate("2026-01-31", 2)).toBe("2026-03-31T00:00:00.000Z");
    expect(nextMonthlyDate("2028-01-31")).toBe("2028-02-29T00:00:00.000Z");
  });
  it("keeps savings and ledger obligations out of the bill list", () => {
    expect(selectUpcomingBills([event(), event({ category: "Savings" }), event({ category: "Repayment" })])).toHaveLength(1);
  });
  it("counts only confirmed reserves as goal progress", () => {
    expect(savingsProgressForGoal([event({ category: "Savings", counterparty: "Trip", amount: 200 }), event({ category: "Savings", counterparty: "Trip", amount: 25, record: "actual" })], "Trip")).toBe(25);
  });
  it("reports spending only for actual expenses in this month", () => {
    const spend = spendByCategoryThisMonth([event(), event({ record: "actual", amount: 25 }), event({ record: "actual", date: "2026-09-01", amount: 1000 }), event({ record: "actual", direction: "income", amount: 500 })]);
    expect(spend.get("Utilities")).toBe(25);
  });
});

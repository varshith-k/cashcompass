import { connection } from "next/server";
import { CalendarClock, PiggyBank, Receipt } from "lucide-react";
import { HeroOverview } from "@/components/dashboard/hero-overview";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ForecastChart } from "@/components/dashboard/forecast-chart";
import { InsightCard } from "@/components/dashboard/insight-card";
import {
  RecentTransactionsCard,
  UpcomingBillsCard,
} from "@/components/dashboard/recent-activity";
import { computeForecast, computeSafeToSpend, sumByDirection } from "@/lib/finance/calculations";
import {
  DEMO_PREFERRED_BUFFER,
  DEMO_STARTING_BALANCE,
  getDemoEvents,
  getDemoRecentTransactions,
  getDemoUpcomingBills,
} from "@/lib/finance/demo-data";
import { formatCurrency, formatRelativeDay } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FORECAST_HISTORY_DAYS = 5;
const FORECAST_TOTAL_DAYS = 35;

export default async function OverviewPage() {
  await connection();

  const DEMO_EVENTS = getDemoEvents();
  const DEMO_UPCOMING_BILLS = getDemoUpcomingBills(DEMO_EVENTS);
  const DEMO_RECENT_TRANSACTIONS = getDemoRecentTransactions(DEMO_EVENTS);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - FORECAST_HISTORY_DAYS);

  const forecast = computeForecast(DEMO_STARTING_BALANCE, DEMO_EVENTS, {
    days: FORECAST_TOTAL_DAYS,
    startDate,
    lowBalanceThreshold: DEMO_PREFERRED_BUFFER,
  });

  const todayIndex = FORECAST_HISTORY_DAYS;
  const currentBalance = forecast[todayIndex].projectedBalance;

  const upcomingBillsTotal = DEMO_UPCOMING_BILLS.reduce((sum, bill) => sum + bill.amount, 0);
  const savingsEarmarks = DEMO_EVENTS.filter((e) => e.category === "Savings").reduce(
    (sum, e) => sum + e.amount,
    0,
  );

  const { safeToSpend } = computeSafeToSpend({
    availableBalance: currentBalance,
    upcomingBills: upcomingBillsTotal,
    savingsEarmarks,
    preferredBuffer: DEMO_PREFERRED_BUFFER,
  });

  const nextPayday = DEMO_EVENTS.filter(
    (e) => e.category === "Payroll" && e.record === "planned",
  ).sort((a, b) => a.date.localeCompare(b.date))[0];

  const monthlyIncome = sumByDirection(
    DEMO_EVENTS.filter((e) => e.record === "actual" || e.record === "planned"),
    "income",
  );
  const monthlyExpenses = sumByDirection(
    DEMO_EVENTS.filter((e) => e.category !== "Savings"),
    "expense",
  );

  const nextBill = DEMO_UPCOMING_BILLS[0];
  const savingsGoalTarget = 600;
  const savingsProgressPct = Math.min(100, Math.round((savingsEarmarks / savingsGoalTarget) * 100));

  return (
    <div className="space-y-6">
      <HeroOverview
        availableBalance={currentBalance}
        safeToSpend={safeToSpend}
        reservedForBills={upcomingBillsTotal}
        nextPaydayDate={nextPayday?.date ?? new Date().toISOString()}
        nextPaydayAmount={nextPayday?.amount ?? 0}
        outlook={forecast.some((p) => p.isLowBalanceRisk) ? "tight" : "on-track"}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Monthly income"
          value={formatCurrency(monthlyIncome)}
          icon={Receipt}
          sublabel="This month"
        />
        <MetricCard
          label="Monthly expenses"
          value={formatCurrency(monthlyExpenses)}
          icon={Receipt}
          sublabel="This month"
        />
        <MetricCard
          label="Upcoming bills"
          value={formatCurrency(upcomingBillsTotal)}
          icon={CalendarClock}
          sublabel={`${DEMO_UPCOMING_BILLS.length} bills`}
        />
        <MetricCard
          label="Savings progress"
          value={`${savingsProgressPct}%`}
          icon={PiggyBank}
          sublabel="Miami trip goal"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cash-flow forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <ForecastChart points={forecast} bufferThreshold={DEMO_PREFERRED_BUFFER} todayIndex={todayIndex} />
        </CardContent>
      </Card>

      {nextBill && (
        <InsightCard
          message={`Your ${nextBill.category.toLowerCase()} payment of ${formatCurrency(nextBill.amount, { cents: true })} to ${nextBill.counterparty} is due ${formatRelativeDay(nextBill.date).toLowerCase()}. Spending beyond your Safe to Spend amount today may reduce your buffer.`}
          ctaLabel="Explore safer options"
          ctaHref="/cash-flow"
        />
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <RecentTransactionsCard transactions={DEMO_RECENT_TRANSACTIONS} />
        <UpcomingBillsCard bills={DEMO_UPCOMING_BILLS} />
      </div>
    </div>
  );
}

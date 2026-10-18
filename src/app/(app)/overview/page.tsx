import { BalanceSetupNotice } from "@/components/dashboard/balance-setup-notice";
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
import {
  computeForecast,
  computeAvailableBalance,
  computeSafeToSpend,
  savingsProgressForGoal,
  selectRecentTransactions,
  selectUpcomingBills,
  sumByDirection,
} from "@/lib/finance/calculations";
import { DEMO_PREFERRED_BUFFER } from "@/lib/finance/demo-data";
import { getFinancialSnapshot } from "@/lib/finance/snapshot";
import { formatCurrency, formatRelativeDay } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FORECAST_HISTORY_DAYS = 5;
const FORECAST_TOTAL_DAYS = 35;

export default async function OverviewPage() {
  await connection();

  const snapshot = await getFinancialSnapshot();
  const { balanceBasis, events } = snapshot;
  if (balanceBasis.source === "unconfigured") return <BalanceSetupNotice />;
  const upcomingBills = selectUpcomingBills(events);
  const recentTransactions = selectRecentTransactions(events);

  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - FORECAST_HISTORY_DAYS);

  const forecast = computeForecast(balanceBasis.openingBalance, events, {
    days: FORECAST_TOTAL_DAYS,
    startDate,
    lowBalanceThreshold: DEMO_PREFERRED_BUFFER,
  });

  const todayIndex = FORECAST_HISTORY_DAYS;
  const currentBalance = computeAvailableBalance(balanceBasis.openingBalance, events);

  const upcomingBillsTotal = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0);
  const savingsEarmarks = events.filter((e) => e.category === "Savings" && e.record === "planned").reduce(
    (sum, e) => sum + e.amount,
    0,
  );

  const { safeToSpend } = computeSafeToSpend({
    availableBalance: currentBalance,
    upcomingBills: upcomingBillsTotal,
    savingsEarmarks,
    preferredBuffer: DEMO_PREFERRED_BUFFER,
  });

  const nextPayday = events.filter(
    (e) => e.category === "Payroll" && e.record === "planned" && e.date.slice(0, 10) >= new Date().toISOString().slice(0, 10),
  ).sort((a, b) => a.date.localeCompare(b.date))[0];

  const monthlyIncome = sumByDirection(
    events.filter((e) => e.record === "actual" && e.date.startsWith(new Date().toISOString().slice(0, 7))),
    "income",
  );
  const monthlyExpenses = sumByDirection(
    events.filter((e) => e.record === "actual" && e.category !== "Savings" && e.date.startsWith(new Date().toISOString().slice(0, 7))),
    "expense",
  );

  const nextBill = upcomingBills[0];
  const primaryGoal = snapshot.profile.goals[0];
  const savingsProgressPct = primaryGoal
    ? Math.min(100, Math.round((savingsProgressForGoal(events, primaryGoal.name) / primaryGoal.targetAmount) * 100))
    : 0;

  return (
    <div className="space-y-6">
      <HeroOverview
        availableBalance={currentBalance}
        safeToSpend={safeToSpend}
        reservedForBills={upcomingBillsTotal}
        nextPaydayDate={nextPayday?.date ?? null}
        nextPaydayAmount={nextPayday?.amount ?? 0}
        savingsEarmarks={savingsEarmarks}
        preferredBuffer={DEMO_PREFERRED_BUFFER}
        outlook={forecast.slice(todayIndex).some((p) => p.isLowBalanceRisk) ? "tight" : "on-track"}
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
          sublabel={`${upcomingBills.length} bills`}
        />
        <MetricCard
          label="Savings progress"
          value={`${savingsProgressPct}%`}
          icon={PiggyBank}
          sublabel={primaryGoal?.name ?? "No goal set"}
        />
      </div>

      <p className="text-xs text-muted-foreground">{balanceBasis.description} Monthly bills repeat; unlisted everyday spending is excluded. The conservative balance excludes uncertain repayments. Savings contributions reserve funds here; no money is transferred.</p>

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
        <RecentTransactionsCard transactions={recentTransactions} />
        <UpcomingBillsCard bills={upcomingBills} />
      </div>
    </div>
  );
}

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
  findNextPayday,
  safeToSpendWindow,
  savingsProgressForGoal,
  selectRecentTransactions,
  selectUpcomingBills,
  sumByDirection,
} from "@/lib/finance/calculations";
import { forecastInputs } from "@/lib/finance/forecast-inputs";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { getWishlistGoals } from "@/lib/finance/wishlist-goals";
import { requireOwnerId } from "@/lib/auth/session";
import { formatCurrency, formatRelativeDay } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OverviewPage() {
  await connection();

  const events = await getFinancialEventRepository().listEvents();
  const upcomingBills = selectUpcomingBills(events);
  const recentTransactions = selectRecentTransactions(events);

  const inputs = forecastInputs(events);
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - inputs.historyDays);

  const forecast = computeForecast(inputs.openingBalance, events, {
    days: inputs.forecastDays,
    startDate,
    lowBalanceThreshold: inputs.bufferThreshold,
    dailySpend: inputs.dailySpend,
  });

  const todayIndex = inputs.historyDays;
  const currentBalance = computeAvailableBalance(inputs.openingBalance, events);

  const upcomingBillsTotal = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0);
  // Safe to Spend only holds back what falls due before the next paycheck.
  const window = safeToSpendWindow(events, inputs.dailySpend);
  const { safeToSpend } = computeSafeToSpend({
    availableBalance: currentBalance,
    upcomingBills: window.bills,
    savingsEarmarks: window.savings,
    debtsOwed: window.debtsOwed,
    everydaySpending: window.everydaySpending,
    preferredBuffer: inputs.bufferThreshold,
  });

  const nextPayday = findNextPayday(events);

  const monthlyIncome = sumByDirection(
    events.filter((e) => e.record === "actual" && e.date.startsWith(new Date().toISOString().slice(0, 7))),
    "income",
  );
  const monthlyExpenses = sumByDirection(
    events.filter((e) => e.record === "actual" && e.category !== "Savings" && e.date.startsWith(new Date().toISOString().slice(0, 7))),
    "expense",
  );

  const nextBill = upcomingBills[0];
  const primaryGoal = getWishlistGoals(await requireOwnerId())[0];
  const savingsProgressPct = primaryGoal
    ? Math.min(100, Math.round((savingsProgressForGoal(events, primaryGoal.name) / primaryGoal.targetAmount) * 100))
    : 0;

  return (
    <div className="space-y-6">
      <HeroOverview
        availableBalance={currentBalance}
        safeToSpend={safeToSpend}
        reservedForBills={window.bills}
        nextPaydayDate={nextPayday?.date ?? null}
        nextPaydayAmount={nextPayday?.amount ?? 0}
        savingsEarmarks={window.savings}
        debtsOwed={window.debtsOwed}
        everydaySpending={window.everydaySpending}
        dailySpend={inputs.dailySpend}
        windowEndDate={window.endDate}
        preferredBuffer={inputs.bufferThreshold}
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

      <p className="text-xs text-muted-foreground">Forecast from your opening balance and recorded events. Monthly bills and paychecks repeat. Everyday spending is estimated at {formatCurrency(inputs.dailySpend, { cents: true })}/day from your last 30 days of purchases. The conservative balance excludes uncertain repayments. Savings contributions reserve funds here; no money is transferred.</p>

      <Card>
        <CardHeader>
          <CardTitle>Cash-flow forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <ForecastChart points={forecast} bufferThreshold={inputs.bufferThreshold} todayIndex={todayIndex} />
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

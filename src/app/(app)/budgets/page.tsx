import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { BudgetsGrid } from "@/components/budgets/budgets-grid";
import { EditBudgetsSheet } from "@/components/budgets/edit-budgets-sheet";
import { InsightCard } from "@/components/dashboard/insight-card";
import { getBudgets } from "@/lib/finance/budgets";
import { spendByCategoryThisMonth } from "@/lib/finance/calculations";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { formatCurrency } from "@/lib/format";

export default async function BudgetsPage() {
  await connection();

  const events = await getFinancialEventRepository().listEvents();
  const spendByCategory = spendByCategoryThisMonth(events);
  const budgets = getBudgets();

  const budgetsWithSpend = budgets.map((budget) => ({
    ...budget,
    spent: spendByCategory.get(budget.category) ?? 0,
  }));

  const overBudget = budgetsWithSpend.find((b) => b.monthlyLimit > 0 && b.spent > b.monthlyLimit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description="Category allocations against what you've actually spent this month."
        actions={<EditBudgetsSheet budgets={budgets} />}
      />

      {overBudget && (
        <InsightCard
          message={`You're ${formatCurrency(overBudget.spent - overBudget.monthlyLimit, { cents: true })} over your ${overBudget.category} budget this month. Adjusting the limit or easing up here keeps the rest of your plan on track.`}
          ctaLabel="Review transactions"
          ctaHref="/transactions"
        />
      )}

      <BudgetsGrid budgets={budgetsWithSpend} />
    </div>
  );
}

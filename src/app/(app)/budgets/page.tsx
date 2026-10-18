import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { BudgetsGrid } from "@/components/budgets/budgets-grid";
import { EditBudgetsSheet } from "@/components/budgets/edit-budgets-sheet";
import { InsightCard } from "@/components/dashboard/insight-card";
import { requireOwnerId } from "@/lib/auth/session";
import { getBudgets } from "@/lib/finance/budgets";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { formatCurrency } from "@/lib/format";

export default async function BudgetsPage() {
  await connection();

  // Reads the Tiger Data continuous aggregate directly in DB mode, instead
  // of fetching every event and summing in JS - see repository.ts.
  const spendByCategory = await getFinancialEventRepository().getMonthlyCategorySpend();
  const budgets = getBudgets(await requireOwnerId());

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

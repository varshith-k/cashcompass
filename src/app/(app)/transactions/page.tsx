import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { AddTransactionSheet } from "@/components/transactions/add-transaction-sheet";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { UpcomingIncomeList } from "@/components/transactions/upcoming-income-list";
import { selectRecentTransactions, selectUpcomingIncome } from "@/lib/finance/calculations";
import { getFinancialEventRepository } from "@/lib/finance/repository";

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await connection();

  const { q } = await searchParams;
  const events = await getFinancialEventRepository().listEvents();
  const transactions = selectRecentTransactions(events);
  const upcomingIncome = selectUpcomingIncome(events);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Manual entries and Capital One Nessie demo records, in one history."
        actions={<AddTransactionSheet />}
      />
      <UpcomingIncomeList income={upcomingIncome} />
      <TransactionsTable key={typeof q === "string" ? q : ""} initialSearch={typeof q === "string" ? q.slice(0, 200) : ""} transactions={transactions} />
    </div>
  );
}

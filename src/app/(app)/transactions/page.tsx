import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { AddTransactionSheet } from "@/components/transactions/add-transaction-sheet";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { selectRecentTransactions } from "@/lib/finance/calculations";
import { getFinancialEventRepository } from "@/lib/finance/repository";

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await connection();

  const { q } = await searchParams;
  const events = await getFinancialEventRepository().listEvents();
  const transactions = selectRecentTransactions(events);

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Manual entries and Capital One Nessie demo records, in one history."
        actions={<AddTransactionSheet />}
      />
      <TransactionsTable key={typeof q === "string" ? q : ""} initialSearch={typeof q === "string" ? q.slice(0, 200) : ""} transactions={transactions} />
    </div>
  );
}

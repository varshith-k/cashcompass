import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { AddTransactionSheet } from "@/components/transactions/add-transaction-sheet";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { selectRecentTransactions } from "@/lib/finance/calculations";
import { getFinancialEventRepository } from "@/lib/finance/repository";

export default async function TransactionsPage() {
  await connection();

  const events = await getFinancialEventRepository().listEvents();
  const transactions = selectRecentTransactions(events);

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Manual entries and Capital One Nessie demo records, in one history."
        actions={<AddTransactionSheet />}
      />
      <TransactionsTable transactions={transactions} />
    </div>
  );
}

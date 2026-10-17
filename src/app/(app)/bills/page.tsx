import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { AddBillSheet } from "@/components/bills/add-bill-sheet";
import { BillsTable } from "@/components/bills/bills-table";
import { selectUpcomingBills } from "@/lib/finance/calculations";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { formatCurrency } from "@/lib/format";

export default async function BillsPage() {
  await connection();

  const events = await getFinancialEventRepository().listEvents();
  const bills = selectUpcomingBills(events);
  const monthlyTotal = bills.reduce((sum, bill) => sum + bill.amount, 0);

  return (
    <div>
      <PageHeader
        title="Bills & Payments"
        description={`${bills.length} upcoming, totaling ${formatCurrency(monthlyTotal, { cents: true })}.`}
        actions={<AddBillSheet />}
      />
      <BillsTable bills={bills} />
    </div>
  );
}

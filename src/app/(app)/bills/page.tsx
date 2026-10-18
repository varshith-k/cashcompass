import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { AddBillSheet } from "@/components/bills/add-bill-sheet";
import { AddReceiptSheet } from "@/components/bills/add-receipt-sheet";
import { BillsTable } from "@/components/bills/bills-table";
import { ReceiptsList } from "@/components/bills/receipts-list";
import { requireOwnerId } from "@/lib/auth/session";
import { getReminderStore } from "@/lib/finance/bill-reminders";
import { selectUpcomingBills } from "@/lib/finance/calculations";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "upcoming", label: "Upcoming bills" },
  { id: "receipts", label: "Receipts" },
] as const;

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await connection();

  const { tab } = await searchParams;
  const active = tab === "receipts" ? "receipts" : "upcoming";
  const ownerId = await requireOwnerId();
  const events = await getFinancialEventRepository().listEvents();
  const bills = selectUpcomingBills(events);
  const upcomingTotal = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const receipts = events.filter((e) => e.isReceipt && e.record === "actual").sort((a, b) => b.date.localeCompare(a.date));
  // Who each receipt was split with (balances created by Split a bill link back via sourceRecordId).
  const splits: Record<string, string[]> = {};
  for (const e of events) {
    if (e.sourceRecordId?.startsWith("split/")) (splits[e.sourceRecordId.slice(6)] ??= []).push(e.counterparty);
  }
  const reminders = Object.fromEntries(
    (await getReminderStore().listForOwner(ownerId)).map((r) => [r.billId, { daysBefore: r.daysBefore, hour: r.hour }]),
  );

  return (
    <div>
      <PageHeader
        title="Bills & Payments"
        description={
          active === "upcoming"
            ? `${bills.length} upcoming, totaling ${formatCurrency(upcomingTotal, { cents: true })}.`
            : "Receipts for things you've already paid for, with notes."
        }
        actions={active === "upcoming" ? <AddBillSheet /> : <AddReceiptSheet />}
      />

      <nav aria-label="Bills and receipts" className="mb-4 inline-flex rounded-lg border border-border bg-card p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "upcoming" ? "/bills" : "/bills?tab=receipts"}
            aria-current={active === t.id ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors min-h-9 inline-flex items-center",
              active === t.id ? "bg-interactive text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.id === "receipts" && receipts.length > 0 && <span className="ml-1.5 tabular-nums opacity-80">{receipts.length}</span>}
          </Link>
        ))}
      </nav>

      {active === "upcoming" ? <BillsTable bills={bills} reminders={reminders} /> : <ReceiptsList receipts={receipts} splits={splits} />}
    </div>
  );
}

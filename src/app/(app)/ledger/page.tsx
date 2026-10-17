import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { AddLedgerEntrySheet } from "@/components/ledger/add-ledger-entry-sheet";
import { LedgerList } from "@/components/ledger/ledger-list";
import { selectLedgerEntries } from "@/lib/finance/calculations";
import { getFinancialEventRepository } from "@/lib/finance/repository";

export default async function LedgerPage() {
  await connection();

  const events = await getFinancialEventRepository().listEvents();
  const { owedToMe, iOwe } = selectLedgerEntries(events);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Money Owed / Lent"
        description="Expected repayments feed the forecast as uncertain — never counted as guaranteed cash."
        actions={<AddLedgerEntrySheet />}
      />
      <LedgerList
        title="Owed to you"
        entries={owedToMe}
        emptyText="Nobody owes you anything right now."
      />
      <LedgerList
        title="You owe"
        entries={iOwe}
        emptyText="You don't owe anyone right now."
      />
    </div>
  );
}

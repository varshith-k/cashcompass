import { HandCoins } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function LedgerPage() {
  return (
    <div>
      <PageHeader
        title="Money Owed / Lent"
        description="A lightweight ledger for who owes whom, expected repayment dates, and settlement status."
      />
      <ComingSoon
        icon={HandCoins}
        title="The ledger is next up"
        description="Planned for Phase 5. Expected repayments will feed the forecast as uncertain, clearly distinguished from confirmed cash."
      />
    </div>
  );
}

import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function TransactionsPage() {
  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Search, filter, and quick-add manual and Capital One Nessie demo transactions."
      />
      <ComingSoon
        icon={Receipt}
        title="Transaction history is next up"
        description="Full history, filters, and quick-add are planned for Phase 3. The shared financial-event model this will read from already powers the Overview dashboard."
      />
    </div>
  );
}

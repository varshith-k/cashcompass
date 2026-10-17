import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function CashFlowPage() {
  return (
    <div>
      <PageHeader
        title="Cash Flow"
        description="The full forecast timeline and what-if scenario simulator — buy now vs. after payday, delay an expense, and more."
      />
      <ComingSoon
        icon={TrendingUp}
        title="The what-if simulator is next up"
        description="Planned for Phase 4. The Overview dashboard already shows the baseline forecast this page will extend with reversible scenario comparisons."
      />
    </div>
  );
}

import { PiggyBank } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function BudgetsPage() {
  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Category allocations, spending vs limits, and constructive overspending warnings."
      />
      <ComingSoon
        icon={PiggyBank}
        title="Budget planning is next up"
        description="Planned for Phase 5, feeding into the same forecast engine as every other module."
      />
    </div>
  );
}

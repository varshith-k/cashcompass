import { Target } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function WishlistPage() {
  return (
    <div>
      <PageHeader
        title="Wishlist & Goals"
        description="Plan a purchase, track savings progress, and compare buying now vs. after saving."
      />
      <ComingSoon
        icon={Target}
        title="Wishlist goals are next up"
        description="Planned for Phase 5. The Overview dashboard's savings-progress metric is a preview of what this page will manage in full."
      />
    </div>
  );
}

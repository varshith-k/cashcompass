import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function BillsPage() {
  return (
    <div>
      <PageHeader
        title="Bills & Payments"
        description="Upcoming bills, due-date timeline, recurring configuration, and reminders."
      />
      <ComingSoon
        icon={CalendarClock}
        title="Full bill tracking is next up"
        description="Planned for Phase 3, alongside transactions and Nessie sync. The Overview dashboard already surfaces upcoming bills from the same financial-event data this page will manage."
      />
    </div>
  );
}

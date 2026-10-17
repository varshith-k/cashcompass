import { ActionForm } from "@/components/ui/action-form";
import { CalendarClock, CheckCircle2, Repeat, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteBill, markBillPaid } from "@/lib/finance/actions";
import type { FinancialEvent } from "@/lib/finance/types";
import { formatCurrency, formatRelativeDay } from "@/lib/format";
import { daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

function urgencyOf(iso: string) {
  const diffDays = daysUntil(iso);
  if (diffDays < 0) return "overdue" as const;
  if (diffDays <= 3) return "urgent" as const;
  return "normal" as const;
}

export function BillsTable({ bills }: { bills: FinancialEvent[] }) {
  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-16 text-muted-foreground rounded-xl border border-border bg-card">
        <CalendarClock className="size-8" strokeWidth={1.5} />
        <p className="text-sm max-w-xs">No upcoming bills tracked yet. Add one to get reminders here.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {bills.map((bill) => {
        const urgency = urgencyOf(bill.date);
        return (
          <li key={bill.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3">
            <div className="rounded-full p-2 bg-muted text-muted-foreground shrink-0">
              <CalendarClock className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{bill.counterparty}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {bill.category}
                </Badge>
                {bill.recurrence === "recurring" && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                    <Repeat className="size-2.5" />
                    Recurring
                  </Badge>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-medium tabular-nums">{formatCurrency(bill.amount, { cents: true })}</p>
              <Badge
                variant="outline"
                className={cn(
                  "mt-0.5 text-[10px] px-1.5 py-0 gap-1",
                  urgency === "overdue" && "border-critical/40 text-critical",
                  urgency === "urgent" && "border-caution/40 text-caution",
                  urgency === "normal" && "border-border text-muted-foreground",
                )}
              >
                {urgency !== "normal" && <span aria-hidden>⚠</span>}
                {urgency === "overdue" ? "Overdue" : formatRelativeDay(bill.date)}
              </Badge>
            </div>

            <ActionForm action={markBillPaid}>
              <input type="hidden" name="id" value={bill.id} />
              <Button type="submit" variant="outline" size="sm" className="gap-1.5 shrink-0">
                <CheckCircle2 className="size-3.5" />
                Mark paid
              </Button>
            </ActionForm>

            <ActionForm action={deleteBill}>
              <input type="hidden" name="id" value={bill.id} />
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete bill from ${bill.counterparty}`}
                className="text-muted-foreground hover:text-critical shrink-0"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </ActionForm>
          </li>
        );
      })}
    </ul>
  );
}

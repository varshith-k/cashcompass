import Link from "next/link";
import { Receipt, SplitSquareHorizontal, StickyNote, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteReceipt } from "@/lib/finance/actions";
import type { FinancialEvent } from "@/lib/finance/types";
import { formatCurrency, formatShortDate } from "@/lib/format";

/** Logged receipts (already-paid purchases), newest first, with this month's total by category. */
export function ReceiptsList({ receipts, splits = {} }: { receipts: FinancialEvent[]; splits?: Record<string, string[]> }) {
  if (receipts.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-16 text-muted-foreground rounded-xl border border-border bg-card">
        <Receipt className="size-8" strokeWidth={1.5} />
        <p className="text-sm max-w-xs">
          No receipts yet. Use <span className="font-medium text-foreground">Add receipt</span> to snap a restaurant, shop or cab bill
          right after you pay.
        </p>
      </div>
    );
  }

  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = receipts.filter((r) => r.date.startsWith(month));
  const monthTotal = thisMonth.reduce((sum, r) => sum + r.amount, 0);
  const byCategory = new Map<string, number>();
  for (const r of thisMonth) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.amount);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm">
          <span className="font-medium">This month:</span> {formatCurrency(monthTotal, { cents: true })} across {thisMonth.length}{" "}
          {thisMonth.length === 1 ? "receipt" : "receipts"}
        </p>
        {byCategory.size > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[...byCategory.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([category, total]) => `${category} ${formatCurrency(total, { cents: true })}`)
              .join(" · ")}
          </p>
        )}
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {receipts.map((receipt) => (
          <li key={receipt.id} className="flex items-start gap-3 px-4 py-3">
            <div className="rounded-full p-2 bg-muted text-muted-foreground shrink-0">
              <Receipt className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{receipt.counterparty}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {receipt.category}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatShortDate(receipt.date)}</span>
              </div>
              {receipt.notes && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <StickyNote className="size-3.5 mt-px shrink-0" aria-hidden="true" />
                  <span className="whitespace-pre-line break-words">{receipt.notes}</span>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <p className="text-sm font-medium tabular-nums">{formatCurrency(receipt.amount, { cents: true })}</p>
              {splits[receipt.id]?.length ? (
                <span className="text-xs text-positive">Split with {splits[receipt.id]!.join(", ")}</span>
              ) : (
                <Link href={`/settle-up?split=${receipt.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-interactive hover:underline">
                  <SplitSquareHorizontal className="size-3.5" aria-hidden="true" />
                  Split
                </Link>
              )}
            </div>
            <ActionForm action={deleteReceipt}>
              <input type="hidden" name="id" value={receipt.id} />
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete receipt from ${receipt.counterparty}`}
                className="text-muted-foreground hover:text-critical shrink-0"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </ActionForm>
          </li>
        ))}
      </ul>
    </div>
  );
}

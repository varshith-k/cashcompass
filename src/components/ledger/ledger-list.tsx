import { HandCoins, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteLedgerEntry, logLedgerPayment } from "@/lib/finance/actions";
import type { FinancialEvent } from "@/lib/finance/types";
import { formatCurrency, formatRelativeDay } from "@/lib/format";

export function LedgerList({
  title,
  entries,
  emptyText,
}: {
  title: string;
  entries: FinancialEvent[];
  emptyText: string;
}) {
  return (
    <div>
      <h2 className="font-heading text-sm font-semibold text-muted-foreground mb-2">{title}</h2>
      {entries.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-10 text-muted-foreground rounded-xl border border-border bg-card">
          <HandCoins className="size-7" strokeWidth={1.5} />
          <p className="text-sm max-w-xs">{emptyText}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-32">
                <p className="text-sm font-medium truncate">{entry.counterparty}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {entry.certainty === "uncertain" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-caution/40 text-caution">
                      Uncertain
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">Expected {formatRelativeDay(entry.date)}</span>
                </div>
              </div>

              <p className="text-sm font-medium tabular-nums shrink-0">
                {formatCurrency(entry.amount, { cents: true })}
              </p>

              <form action={logLedgerPayment} className="flex items-center gap-2 shrink-0">
                <input type="hidden" name="id" value={entry.id} />
                <Input
                  name="amountPaid"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={entry.amount}
                  className="h-8 w-24"
                  aria-label={`Amount settled for ${entry.counterparty}`}
                />
                <Button type="submit" size="sm" variant="outline">
                  Log payment
                </Button>
              </form>

              <form action={deleteLedgerEntry}>
                <input type="hidden" name="id" value={entry.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete entry for ${entry.counterparty}`}
                  className="text-muted-foreground hover:text-critical"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

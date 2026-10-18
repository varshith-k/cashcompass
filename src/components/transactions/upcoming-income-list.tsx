import { Repeat, Trash2, Wallet } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteUpcomingIncome } from "@/lib/finance/actions";
import type { FinancialEvent } from "@/lib/finance/types";
import { formatCurrency, formatRelativeDay } from "@/lib/format";

/** Scheduled, not-yet-received income — set up via Add Transaction's "Recurring" switch. This is what populates "Next payday" on Overview. */
export function UpcomingIncomeList({ income }: { income: FinancialEvent[] }) {
  if (income.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4" aria-hidden="true" />
          Upcoming income
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y divide-border">
          {income.map((event) => (
            <li key={event.id} className="flex items-center gap-3 px-6 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{event.counterparty}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {event.category}
                  </Badge>
                  {event.recurrence === "recurring" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                      <Repeat className="size-2.5" />
                      Recurring
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{formatRelativeDay(event.date)}</span>
                </div>
              </div>
              <p className="text-sm font-medium tabular-nums text-positive shrink-0">
                +{formatCurrency(event.amount, { cents: true })}
              </p>
              <ActionForm action={deleteUpcomingIncome}>
                <input type="hidden" name="id" value={event.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove upcoming income from ${event.counterparty}`}
                  className="text-muted-foreground hover:text-critical"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </ActionForm>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

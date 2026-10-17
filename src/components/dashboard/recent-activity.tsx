import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FinancialEvent } from "@/lib/finance/types";
import { formatCurrency, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RecentTransactionsCard({ transactions }: { transactions: FinancialEvent[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-heading">Recent transactions</CardTitle>
        <Button render={<Link href="/transactions">View all</Link>} variant="ghost" size="sm" />
      </CardHeader>
      <CardContent className="px-0">
        {transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            text="No expenses yet. Add your first transaction to start understanding your spending."
          />
        ) : (
          <ul className="divide-y divide-border">
            {transactions.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-6 py-3">
                <div
                  className={cn(
                    "rounded-full p-2 shrink-0",
                    t.direction === "income" ? "bg-positive/10 text-positive" : "bg-muted text-muted-foreground",
                  )}
                >
                  {t.direction === "income" ? (
                    <ArrowDownLeft className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.counterparty}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.category} · {formatRelativeDay(t.date)}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-sm font-medium tabular-nums shrink-0",
                    t.direction === "income" ? "text-positive" : "text-foreground",
                  )}
                >
                  {t.direction === "income" ? "+" : "-"}
                  {formatCurrency(t.amount, { cents: true })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function UpcomingBillsCard({ bills }: { bills: FinancialEvent[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-heading">Upcoming bills</CardTitle>
        <Button render={<Link href="/bills">View all</Link>} variant="ghost" size="sm" />
      </CardHeader>
      <CardContent className="px-0">
        {bills.length === 0 ? (
          <EmptyState icon={CalendarClock} text="No upcoming bills tracked yet." />
        ) : (
          <ul className="divide-y divide-border">
            {bills.slice(0, 5).map((bill) => {
              const urgent = isUrgent(bill.date);
              return (
                <li key={bill.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="rounded-full p-2 bg-muted text-muted-foreground shrink-0">
                    <CalendarClock className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{bill.counterparty}</p>
                    <p className="text-xs text-muted-foreground">{bill.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium tabular-nums">
                      {formatCurrency(bill.amount, { cents: true })}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "mt-0.5 text-[10px] px-1.5 py-0",
                        urgent ? "border-caution/40 text-caution" : "border-border text-muted-foreground",
                      )}
                    >
                      {formatRelativeDay(bill.date)}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function isUrgent(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return diff <= 5;
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 px-6 py-10 text-muted-foreground">
      <Icon className="size-8" strokeWidth={1.5} />
      <p className="text-sm max-w-xs">{text}</p>
    </div>
  );
}

import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { BudgetAllocation } from "@/lib/finance/budgets";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface BudgetWithSpend extends BudgetAllocation {
  spent: number;
}

function toneOf(pct: number) {
  if (pct >= 100) return "critical" as const;
  if (pct >= 80) return "caution" as const;
  return "positive" as const;
}

export function BudgetsGrid({ budgets }: { budgets: BudgetWithSpend[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {budgets.map((budget) => {
        const pct = budget.monthlyLimit > 0 ? (budget.spent / budget.monthlyLimit) * 100 : budget.spent > 0 ? 100 : 0;
        const tone = toneOf(pct);
        const remaining = budget.monthlyLimit - budget.spent;

        return (
          <Card key={budget.category}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{budget.category}</p>
                {tone !== "positive" && (
                  <AlertTriangle
                    className={cn("size-4", tone === "critical" ? "text-critical" : "text-caution")}
                    aria-label={tone === "critical" ? "Over budget" : "Approaching budget limit"}
                  />
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="font-heading text-lg font-semibold tabular-nums">
                    {formatCurrency(budget.spent, { cents: true })}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    of {formatCurrency(budget.monthlyLimit)}
                  </span>
                </div>
                <Progress
                  value={Math.min(pct, 100)}
                  aria-label={`${budget.category} budget used`}
                  className={cn(
                    "block",
                    tone === "critical" && "[&_[data-slot=progress-indicator]]:bg-critical",
                    tone === "caution" && "[&_[data-slot=progress-indicator]]:bg-caution",
                    tone === "positive" && "[&_[data-slot=progress-indicator]]:bg-positive",
                  )}
                />
              </div>

              <p
                className={cn(
                  "text-xs",
                  tone === "critical" ? "text-critical" : "text-muted-foreground",
                )}
              >
                {remaining >= 0
                  ? `${formatCurrency(remaining, { cents: true })} remaining this month`
                  : `${formatCurrency(Math.abs(remaining), { cents: true })} over budget`}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

import { CalendarDays, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { addWishlistContribution, deleteWishlistGoal } from "@/lib/finance/actions";
import type { WishlistGoal } from "@/lib/finance/wishlist-goals";
import { daysUntil, formatCurrency, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function GoalCard({
  goal,
  saved,
  recommendedWeekly,
}: {
  goal: WishlistGoal;
  saved: number;
  recommendedWeekly: number;
}) {
  const pct = goal.targetAmount > 0 ? Math.min(100, (saved / goal.targetAmount) * 100) : 0;
  const daysLeft = daysUntil(goal.targetDate);
  const reached = saved >= goal.targetAmount;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-heading text-base font-semibold">{goal.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <CalendarDays className="size-3.5" />
              {daysLeft >= 0 ? `${daysLeft} days left` : "Target date passed"} · {formatShortDate(goal.targetDate)}
            </p>
          </div>
          <form action={deleteWishlistGoal}>
            <input type="hidden" name="id" value={goal.id} />
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${goal.name}`}
              className="text-muted-foreground hover:text-critical"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </form>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="font-heading text-lg font-semibold tabular-nums">
              {formatCurrency(saved, { cents: true })}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              of {formatCurrency(goal.targetAmount)}
            </span>
          </div>
          <Progress
            value={pct}
            aria-label={`${goal.name} savings progress`}
            className={cn(
              "block",
              reached && "[&_[data-slot=progress-indicator]]:bg-positive",
            )}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {reached
            ? "Goal reached — earmarked, not yet transferred."
            : `Save ${formatCurrency(recommendedWeekly)}/week to get there by ${formatShortDate(goal.targetDate)}.`}
        </p>

        {!reached && (
          <form action={addWishlistContribution} className="flex items-center gap-2">
            <input type="hidden" name="goalName" value={goal.name} />
            <Input
              name="amount"
              type="number"
              min="1"
              step="0.01"
              defaultValue={recommendedWeekly || undefined}
              className="h-8"
              aria-label={`Contribution amount for ${goal.name}`}
            />
            <Button type="submit" size="sm" variant="outline" className="shrink-0">
              Add contribution
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

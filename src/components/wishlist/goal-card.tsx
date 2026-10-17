import { ActionForm } from "@/components/ui/action-form";
import { CalendarDays, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { planWishlistSavings, addWishlistContribution, deleteWishlistGoal } from "@/lib/finance/actions";
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
          <ActionForm action={deleteWishlistGoal}>
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
          </ActionForm>
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
            : daysLeft < 0 ? "Target date passed. This goal needs a new target date." : `Plan ${formatCurrency(recommendedWeekly)}/week toward ${formatShortDate(goal.targetDate)}; compare the schedule in Cash Flow before reserving funds.`}
        </p>

        {!reached && daysLeft >= 7 && <ActionForm action={planWishlistSavings} className="space-y-2">
          <input type="hidden" name="goalId" value={goal.id} />
          <div className="flex items-center gap-2">
            <Input name="weeklyAmount" type="number" min="0.01" step="0.01" defaultValue={recommendedWeekly} aria-label={`Weekly planned savings for ${goal.name}`} className="h-8" />
            <Button type="submit" size="sm" variant="outline" className="shrink-0">Plan weekly savings</Button>
          </div>
          <p className="text-xs text-muted-foreground">Replaces this goal&rsquo;s future savings plan with weekly reserves through the target date (up to 52 weeks). No transfers occur.</p>
        </ActionForm>}
        {!reached && (
          <ActionForm action={addWishlistContribution} className="flex items-center gap-2">
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
          </ActionForm>
        )}
      </CardContent>
    </Card>
  );
}

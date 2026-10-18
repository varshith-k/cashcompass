import { connection } from "next/server";
import { Target } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";
import { AddGoalSheet } from "@/components/wishlist/add-goal-sheet";
import { GoalCard } from "@/components/wishlist/goal-card";
import { recommendedWeeklyContribution, savingsProgressForGoal } from "@/lib/finance/calculations";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { requireOwnerId } from "@/lib/auth/session";
import { getWishlistGoals } from "@/lib/finance/wishlist-goals";

export const metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  await connection();

  const events = await getFinancialEventRepository().listEvents();
  const goals = await getWishlistGoals(await requireOwnerId());

  return (
    <div>
      <PageHeader
        title="Wishlist & Goals"
        description="Plan a purchase, track earmarked savings, and see a recommended weekly amount."
        actions={<AddGoalSheet />}
      />

      {goals.length === 0 ? (
        <ComingSoon
          icon={Target}
          title="No goals yet"
          description="Add a wishlist item with a price and target date to get a recommended savings schedule."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const saved = savingsProgressForGoal(events, goal.name);
            const recommendedWeekly = recommendedWeeklyContribution(goal.targetAmount - saved, goal.targetDate);
            return (
              <GoalCard key={goal.id} goal={goal} saved={saved} recommendedWeekly={recommendedWeekly} />
            );
          })}
        </div>
      )}
    </div>
  );
}

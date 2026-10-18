import "server-only";
import { getPlanningProfile, updatePlanningProfile } from "@/lib/storage/profile";
export interface WishlistGoal { id: string; name: string; targetAmount: number; targetDate: string }
export async function getWishlistGoals(ownerId: string): Promise<WishlistGoal[]> {
  return (await getPlanningProfile(ownerId)).goals;
}
export async function addWishlistGoal(ownerId: string, input: Omit<WishlistGoal, "id">): Promise<WishlistGoal> {
  return updatePlanningProfile(ownerId, (profile) => {
    if (!input.name.trim() || profile.goals.some((goal) => goal.name.toLowerCase() === input.name.toLowerCase())) throw new Error("Use a unique goal name");
    const goal = { ...input, id: crypto.randomUUID() };
    profile.goals.push(goal);
    return goal;
  });
}
export async function deleteWishlistGoal(ownerId: string, id: string) {
  await updatePlanningProfile(ownerId, (profile) => { profile.goals = profile.goals.filter((goal) => goal.id !== id); });
}

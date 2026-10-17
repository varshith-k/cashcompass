import "server-only";

export interface WishlistGoal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string; // ISO
}

function isoDaysFromToday(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

/**
 * Same in-memory-for-the-process-lifetime pattern as demo-repository.ts,
 * kept per user (keyed by Auth0 `sub`).
 */
const stores = new Map<string, WishlistGoal[]>();

function storeFor(ownerId: string) {
  let goals = stores.get(ownerId);
  if (!goals) {
    goals = [
      { id: "goal-miami", name: "Miami Trip Goal", targetAmount: 900, targetDate: isoDaysFromToday(70) },
    ];
    stores.set(ownerId, goals);
  }
  return goals;
}

export function getWishlistGoals(ownerId: string): WishlistGoal[] {
  return storeFor(ownerId);
}

export function addWishlistGoal(ownerId: string, input: Omit<WishlistGoal, "id">): WishlistGoal {
  const goal: WishlistGoal = { ...input, id: crypto.randomUUID() };
  storeFor(ownerId).push(goal);
  return goal;
}

export function deleteWishlistGoal(ownerId: string, id: string) {
  const goals = storeFor(ownerId);
  const index = goals.findIndex((goal) => goal.id === id);
  if (index !== -1) {
    goals.splice(index, 1);
  }
}

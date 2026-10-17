import "server-only";

export interface WishlistGoal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string; // ISO
}

function isoDaysFromToday(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/** Same in-memory-for-the-process-lifetime pattern as demo-repository.ts. */
let store: WishlistGoal[] | null = null;

function ensureStore() {
  if (!store) {
    store = [
      { id: "goal-miami", name: "Miami Trip Goal", targetAmount: 900, targetDate: isoDaysFromToday(70) },
    ];
  }
  return store;
}

export function getWishlistGoals(): WishlistGoal[] {
  return ensureStore();
}

export function addWishlistGoal(input: Omit<WishlistGoal, "id">): WishlistGoal {
  const goal: WishlistGoal = { ...input, id: crypto.randomUUID() };
  ensureStore().push(goal);
  return goal;
}

export function deleteWishlistGoal(id: string) {
  const goals = ensureStore();
  const index = goals.findIndex((goal) => goal.id === id);
  if (index !== -1) {
    goals.splice(index, 1);
  }
}

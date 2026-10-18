"use server";

import { updatePlanningProfile } from "@/lib/storage/profile";
import { revalidatePath } from "next/cache";
import { nextMonthlyDate } from "./dates";
import { requireOwnerId } from "@/lib/auth/session";
import { getFinancialEventRepository, withFinancialTransaction } from "./repository";
import { settleLedgerAmount } from "./ledger";
import { getBudgets, setBudgetLimits } from "./budgets";
import { getWishlistGoals, addWishlistGoal, deleteWishlistGoal as removeWishlistGoal } from "./wishlist-goals";
import type { EventCertainty, EventDirection, NewFinancialEvent } from "./types";

/** Everything needed to reverse a "Mark paid" (returned to the Bills list for its Undo button). */
export interface BillPaidUndo {
  id: string;
  counterparty: string;
  originalDate: string;
  originalCertainty: EventCertainty;
  /** Next month's occurrence created for a recurring bill, removed again on undo. */
  nextId?: string;
}

function parseAmount(raw: FormDataEntryValue | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0.01 || value > 9999999999.99) {
    throw new Error("Amount must be a positive number");
  }
  return Math.round(value * 100) / 100;
}

function parseDirection(raw: FormDataEntryValue | null): EventDirection {
  if (raw === "income" || raw === "expense") return raw;
  throw new Error("Direction must be income or expense");
}

function parseDate(raw: FormDataEntryValue | null): string {
  const value = String(raw);
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid calendar date");
  }
  return date.toISOString();
}

export async function createTransaction(formData: FormData) {
  const input: NewFinancialEvent = {
    date: parseDate(formData.get("date")),
    amount: parseAmount(formData.get("amount")),
    direction: parseDirection(formData.get("direction")),
    record: "actual",
    certainty: "certain",
    recurrence: "one-time",
    source: "manual",
    category: String(formData.get("category") || "Other"),
    counterparty: String(formData.get("counterparty") || "").trim() || "Unknown",
  };

  await getFinancialEventRepository().createEvent(input);
  revalidatePath("/", "layout");
}

export async function updateTransaction(formData: FormData) {
  const repo = getFinancialEventRepository();
  const id = String(formData.get("id"));
  const original = (await repo.listEvents()).find((event) => event.id === id && event.record === "actual");
  if (!original) throw new Error("Transaction not found");
  await repo.updateEvent(id, {
    date: parseDate(formData.get("date")),
    amount: parseAmount(formData.get("amount")),
    direction: parseDirection(formData.get("direction")),
    category: String(formData.get("category") || "Other"),
    counterparty: String(formData.get("counterparty") || "").trim() || "Unknown",
  });
  revalidatePath("/", "layout");
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id"));
  await getFinancialEventRepository().deleteEvent(id);
  revalidatePath("/", "layout");
}

export async function createBill(formData: FormData) {
  const input: NewFinancialEvent = {
    date: parseDate(formData.get("date")),
    amount: parseAmount(formData.get("amount")),
    direction: "expense",
    record: "planned",
    certainty: "certain",
    recurrence: formData.get("recurring") === "on" ? "recurring" : "one-time",
    source: "manual",
    category: String(formData.get("category") || "Other"),
    counterparty: String(formData.get("counterparty") || "").trim() || "Unknown",
  };

  await getFinancialEventRepository().createEvent(input);
  revalidatePath("/", "layout");
}

export async function deleteBill(formData: FormData) {
  const id = String(formData.get("id"));
  await getFinancialEventRepository().deleteEvent(id);
  revalidatePath("/", "layout");
}

export async function markBillPaid(formData: FormData): Promise<BillPaidUndo> {
  return withFinancialTransaction(async () => {
    const id = String(formData.get("id"));
    const repo = getFinancialEventRepository();
    const original = (await repo.listEvents()).find((event) => event.id === id);
    if (!original || original.record !== "planned" || original.direction !== "expense" || ["Savings", "Repayment"].includes(original.category)) {
      throw new Error("Unpaid bill not found");
    }
    await repo.updateEvent(id, { record: "actual", certainty: "certain", date: new Date().toISOString() });
    let nextId: string | undefined;
    if (original.recurrence === "recurring") {
      const { id: previousId, ...next } = original;
      void previousId;
      nextId = (await repo.createEvent({ ...next, source: "manual", sourceRecordId: undefined, date: nextMonthlyDate(original.date) })).id;
    }
    revalidatePath("/", "layout");
    return { id, counterparty: original.counterparty, originalDate: original.date, originalCertainty: original.certainty, nextId };
  });
}

/**
 * Reverses markBillPaid: the payment goes back to an unpaid bill on its
 * original due date, and the auto-created next occurrence is removed. Only
 * touches the signed-in user's own records (the repository is owner-scoped).
 */
export async function undoMarkBillPaid(undo: BillPaidUndo) {
  return withFinancialTransaction(async () => {
    const repo = getFinancialEventRepository();
    const events = await repo.listEvents();
    const paid = events.find((event) => event.id === undo?.id);
    if (!paid || paid.record !== "actual" || paid.direction !== "expense") {
      throw new Error("Paid bill not found");
    }
    // A stored timestamp (not form input), so validate it as a full ISO date.
    const parsed = new Date(String(undo.originalDate));
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid original due date");
    const originalDate = parsed.toISOString();
    await repo.updateEvent(paid.id, {
      record: "planned",
      certainty: undo.originalCertainty === "uncertain" ? "uncertain" : "certain",
      date: originalDate,
    });
    const next = undo.nextId ? events.find((event) => event.id === undo.nextId) : undefined;
    if (next && next.record === "planned" && next.counterparty === paid.counterparty && next.recurrence === "recurring") {
      await repo.deleteEvent(next.id);
    }
    revalidatePath("/", "layout");
  });
}

export async function updateBudgetLimits(formData: FormData) {
  const ownerId = await requireOwnerId();
  const limits: Record<string, number> = {};
  for (const budget of await getBudgets(ownerId)) {
    const raw = formData.get(`limit_${budget.category}`);
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) {
      limits[budget.category] = Math.round(value * 100) / 100;
    }
  }
  await setBudgetLimits(ownerId, limits);
  revalidatePath("/", "layout");
}

export async function createWishlistGoal(formData: FormData) {
  const ownerId = await requireOwnerId();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Goal name is required");
  if ((await getWishlistGoals(ownerId)).some((goal) => goal.name.toLowerCase() === name.toLowerCase())) throw new Error("Use a different goal name");

  await addWishlistGoal(ownerId, {
    name,
    targetAmount: parseAmount(formData.get("targetAmount")),
    targetDate: parseDate(formData.get("targetDate")),
  });
  revalidatePath("/", "layout");
}

export async function deleteWishlistGoal(formData: FormData) {
  return withFinancialTransaction(async () => {
    const ownerId = await requireOwnerId();
    const id = String(formData.get("id"));
    const goal = (await getWishlistGoals(ownerId)).find((item) => item.id === id);
    if (goal) {
      const repo = getFinancialEventRepository();
      for (const event of (await repo.listEvents()).filter((e) => e.category === "Savings" && e.record === "planned" && e.counterparty === goal.name)) await repo.deleteEvent(event.id);
    }
    await removeWishlistGoal(ownerId, id);
    revalidatePath("/", "layout");
  });
}

export async function createLedgerEntry(formData: FormData) {
  const direction = parseDirection(formData.get("direction"));
  await getFinancialEventRepository().createEvent({
    date: parseDate(formData.get("date")),
    amount: parseAmount(formData.get("amount")),
    direction,
    record: "planned",
    // Money owed TO the user isn't guaranteed to arrive; money the user
    // owes is an obligation they intend to pay, so it's treated as certain.
    certainty: direction === "income" ? "uncertain" : "certain",
    recurrence: "one-time",
    source: "manual",
    category: "Repayment",
    counterparty: String(formData.get("counterparty") || "").trim() || "Unknown",
    counterpartyPhone: String(formData.get("phone") || "").trim() || undefined,
  });
  revalidatePath("/", "layout");
}

export async function deleteLedgerEntry(formData: FormData) {
  const id = String(formData.get("id"));
  await getFinancialEventRepository().deleteEvent(id);
  revalidatePath("/", "layout");
}

export async function logLedgerPayment(formData: FormData) {
  const id = String(formData.get("id"));
  const amountPaid = parseAmount(formData.get("amountPaid"));
  await settleLedgerAmount(id, amountPaid);
}

export async function planWishlistSavings(formData: FormData) {
  return withFinancialTransaction(async () => {
    const ownerId = await requireOwnerId();
    const goal = (await getWishlistGoals(ownerId)).find((item) => item.id === String(formData.get("goalId")));
    if (!goal) throw new Error("Goal not found");
    const weeklyAmount = parseAmount(formData.get("weeklyAmount"));
    const repo = getFinancialEventRepository();
    const events = await repo.listEvents();
    const saved = events.filter((e) => e.category === "Savings" && e.counterparty === goal.name && e.record === "actual").reduce((sum, e) => sum + e.amount, 0);
    let remaining = Math.max(0, goal.targetAmount - saved);
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const target = new Date(`${goal.targetDate.slice(0, 10)}T00:00:00.000Z`);
    const weeks = Math.min(52, Math.max(0, Math.ceil((target.getTime() - today.getTime()) / (7 * 86400000))));
    if (!weeks || !remaining) throw new Error("Set a future target date for an unfinished goal");
    for (const event of events.filter((e) => e.category === "Savings" && e.counterparty === goal.name && e.record === "planned")) await repo.deleteEvent(event.id);
    for (let i = 1; i <= weeks && remaining > 0; i++) {
      const date = new Date(Math.min(target.getTime(), today.getTime() + i * 7 * 86400000));
      const amount = Math.min(remaining, weeklyAmount);
      await repo.createEvent({ date: date.toISOString(), amount, direction: "expense", record: "planned", certainty: "certain", recurrence: "recurring", source: "manual", category: "Savings", counterparty: goal.name });
      remaining = Math.round((remaining - amount) * 100) / 100;
    }
    revalidatePath("/", "layout");
  });
}

export async function addWishlistContribution(formData: FormData) {
  return withFinancialTransaction(async () => {
    const ownerId = await requireOwnerId();
    const goalName = String(formData.get("goalName") || "").trim();
    if (!(await getWishlistGoals(ownerId)).some((goal) => goal.name === goalName)) throw new Error("Goal not found");
    const repo = getFinancialEventRepository();
    const amount = parseAmount(formData.get("amount"));
    // Reserving funds now replaces that amount of scheduled future reserves.
    let toConsume = amount;
    const planned = (await repo.listEvents()).filter((e) => e.category === "Savings" && e.counterparty === goalName && e.record === "planned").sort((a, b) => a.date.localeCompare(b.date));
    for (const event of planned) {
      if (toConsume <= 0) break;
      if (toConsume >= event.amount) await repo.deleteEvent(event.id);
      else await repo.updateEvent(event.id, { amount: Math.round((event.amount - toConsume) * 100) / 100 });
      toConsume = Math.round((toConsume - event.amount) * 100) / 100;
    }
    await repo.createEvent({ date: new Date().toISOString(), amount, direction: "expense", record: "actual", certainty: "certain", recurrence: "one-time", source: "manual", category: "Savings", counterparty: goalName });
    revalidatePath("/", "layout");
  });
}

export async function saveBalanceCheckpoint(formData: FormData) {
  const balance = Number(formData.get("balance"));
  if (!Number.isFinite(balance) || balance < 0 || balance > 9999999999.99) throw new Error("Enter a valid balance");
  await withFinancialTransaction(async (ownerId) => {
    const events = await getFinancialEventRepository().listEvents();
    const signedPosted = events.filter((event) => event.record === "actual" && event.date.slice(0, 10) <= new Date().toISOString().slice(0, 10)).reduce((sum, event) => sum + (event.direction === "income" ? event.amount : -event.amount), 0);
    await updatePlanningProfile(ownerId, (profile) => { profile.openingBalance = Math.round((balance - signedPosted) * 100) / 100; });
  });
  revalidatePath("/", "layout");
}

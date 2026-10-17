"use server";

import { revalidatePath } from "next/cache";
import { nextMonthlyDate } from "./dates";
import { requireOwnerId } from "@/lib/auth/session";
import { getFinancialEventRepository } from "./repository";
import { getBudgets, setBudgetLimits } from "./budgets";
import { getWishlistGoals, addWishlistGoal, deleteWishlistGoal as removeWishlistGoal } from "./wishlist-goals";
import type { EventDirection, NewFinancialEvent } from "./types";

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

export async function markBillPaid(formData: FormData) {
  const id = String(formData.get("id"));
  const repo = getFinancialEventRepository();
  const original = (await repo.listEvents()).find((event) => event.id === id);
  if (!original || original.record !== "planned" || original.direction !== "expense" || ["Savings", "Repayment"].includes(original.category)) {
    throw new Error("Unpaid bill not found");
  }
  await repo.updateEvent(id, { record: "actual", certainty: "certain", date: new Date().toISOString() });
  if (original.recurrence === "recurring") {
    const { id: previousId, ...next } = original;
    void previousId;
    await repo.createEvent({ ...next, source: "manual", sourceRecordId: undefined, date: nextMonthlyDate(original.date) });
  }
  revalidatePath("/", "layout");
}

export async function updateBudgetLimits(formData: FormData) {
  const ownerId = await requireOwnerId();
  const limits: Record<string, number> = {};
  for (const budget of getBudgets(ownerId)) {
    const raw = formData.get(`limit_${budget.category}`);
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) {
      limits[budget.category] = Math.round(value * 100) / 100;
    }
  }
  setBudgetLimits(ownerId, limits);
  revalidatePath("/", "layout");
}

export async function createWishlistGoal(formData: FormData) {
  const ownerId = await requireOwnerId();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Goal name is required");
  if (getWishlistGoals(ownerId).some((goal) => goal.name.toLowerCase() === name.toLowerCase())) throw new Error("Use a different goal name");

  addWishlistGoal(ownerId, {
    name,
    targetAmount: parseAmount(formData.get("targetAmount")),
    targetDate: parseDate(formData.get("targetDate")),
  });
  revalidatePath("/", "layout");
}

export async function deleteWishlistGoal(formData: FormData) {
  const ownerId = await requireOwnerId();
  const id = String(formData.get("id"));
  const goal = getWishlistGoals(ownerId).find((item) => item.id === id);
  if (goal) {
    const repo = getFinancialEventRepository();
    for (const event of (await repo.listEvents()).filter((e) => e.category === "Savings" && e.record === "planned" && e.counterparty === goal.name)) await repo.deleteEvent(event.id);
  }
  removeWishlistGoal(ownerId, id);
  revalidatePath("/", "layout");
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

/**
 * Settles (fully or partially) a ledger entry by id. Shared by the manual
 * "Log payment" action and the Solana devnet settlement flow in
 * src/lib/solana/actions.ts, so both record the repayment the same way.
 */
export async function settleLedgerAmount(
  id: string,
  amountPaid: number,
  options?: { counterpartyNote?: string },
) {
  const repo = getFinancialEventRepository();
  const events = await repo.listEvents();
  const original = events.find((event) => event.id === id);
  if (!original || original.category !== "Repayment" || original.record !== "planned") {
    throw new Error("Outstanding ledger entry not found");
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0.01 || amountPaid > original.amount) {
    throw new Error("Payment must be positive and cannot exceed the outstanding amount");
  }
  amountPaid = Math.round(amountPaid * 100) / 100;

  const remaining = original.amount;
  const counterparty = options?.counterpartyNote
    ? `${original.counterparty} (${options.counterpartyNote})`
    : original.counterparty;

  if (amountPaid >= remaining) {
    await repo.updateEvent(id, { record: "actual", certainty: "certain", date: new Date().toISOString(), amount: remaining, counterparty });
  } else {
    await repo.createEvent({
      date: new Date().toISOString(),
      amount: amountPaid,
      direction: original.direction,
      record: "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "manual",
      category: "Repayment",
      counterparty,
    });
    await repo.updateEvent(id, { amount: Math.round((remaining - amountPaid) * 100) / 100 });
  }

  revalidatePath("/", "layout");
}

export async function logLedgerPayment(formData: FormData) {
  const id = String(formData.get("id"));
  const amountPaid = parseAmount(formData.get("amountPaid"));
  await settleLedgerAmount(id, amountPaid);
}

export async function planWishlistSavings(formData: FormData) {
  const ownerId = await requireOwnerId();
  const goal = getWishlistGoals(ownerId).find((item) => item.id === String(formData.get("goalId")));
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
}

export async function addWishlistContribution(formData: FormData) {
  const ownerId = await requireOwnerId();
  const goalName = String(formData.get("goalName") || "").trim();
  if (!getWishlistGoals(ownerId).some((goal) => goal.name === goalName)) throw new Error("Goal not found");
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
}

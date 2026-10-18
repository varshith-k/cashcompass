"use server";

import { revalidatePath } from "next/cache";
import { nextMonthlyDate } from "./dates";
import { requireOwnerId } from "@/lib/auth/session";
import { getFinancialEventRepository } from "./repository";
import { settleLedgerAmount } from "./ledger";
import { findOrAddFriend, getFriend, isValidEmail } from "./friends";
import { getReminderStore } from "./bill-reminders";
import { notifyFriend, type NotifyResult } from "@/lib/email/notify-friend";
import { getBudgets, setBudgetLimits } from "./budgets";
import { getWishlistGoals, addWishlistGoal, deleteWishlistGoal as removeWishlistGoal } from "./wishlist-goals";
import type { EventCertainty, EventDirection, FinancialEvent, NewFinancialEvent } from "./types";

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

/**
 * Deletes only a record of the expected kind, so one form can't remove a
 * different type of record by id (the repository already limits this to
 * the signed-in user's own records).
 */
async function deleteMatching(formData: FormData, matches: (event: FinancialEvent) => boolean, notFound: string) {
  const id = String(formData.get("id"));
  const repo = getFinancialEventRepository();
  const event = (await repo.listEvents()).find((e) => e.id === id);
  if (!event || !matches(event)) throw new Error(notFound);
  await repo.deleteEvent(id);
  revalidatePath("/", "layout");
}

export async function deleteTransaction(formData: FormData) {
  await deleteMatching(formData, (e) => e.record === "actual", "Transaction not found");
}

export async function createBill(formData: FormData) {
  const amount = parseAmount(formData.get("amount"));
  const category = String(formData.get("category") || "Other");
  // Credit card bills: amount is the statement balance; the minimum payment is optional.
  const rawMinimum = String(formData.get("minimumPayment") ?? "").trim();
  let minimumPayment: number | undefined;
  if (category === "Credit card" && rawMinimum) {
    minimumPayment = parseAmount(rawMinimum);
    if (minimumPayment > amount) throw new Error("Minimum payment can't exceed the statement balance");
  }
  const input: NewFinancialEvent = {
    date: parseDate(formData.get("date")),
    amount,
    direction: "expense",
    record: "planned",
    certainty: "certain",
    recurrence: formData.get("recurring") === "on" ? "recurring" : "one-time",
    source: "manual",
    category,
    counterparty: String(formData.get("counterparty") || "").trim() || "Unknown",
    ...(minimumPayment ? { minimumPayment } : {}),
  };

  await getFinancialEventRepository().createEvent(input);
  revalidatePath("/", "layout");
}

export async function deleteBill(formData: FormData) {
  await deleteMatching(
    formData,
    (e) => e.record === "planned" && e.direction === "expense" && !["Savings", "Repayment"].includes(e.category),
    "Bill not found",
  );
  await getReminderStore().remove(await requireOwnerId(), String(formData.get("id")));
}

/** Logs an already-paid purchase from a receipt (Bills & Payments → Receipts). */
export async function createReceipt(formData: FormData) {
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  await getFinancialEventRepository().createEvent({
    date: parseDate(formData.get("date")),
    amount: parseAmount(formData.get("amount")),
    direction: "expense",
    record: "actual",
    certainty: "certain",
    recurrence: "one-time",
    source: "manual",
    category: String(formData.get("category") || "Other"),
    counterparty: String(formData.get("counterparty") || "").trim().slice(0, 80) || "Unknown",
    isReceipt: true,
    ...(notes ? { notes } : {}),
  });
  revalidatePath("/", "layout");
}

export async function deleteReceipt(formData: FormData) {
  await deleteMatching(formData, (e) => e.isReceipt === true && e.record === "actual", "Receipt not found");
}

export async function markBillPaid(formData: FormData): Promise<BillPaidUndo> {
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
    // The reminder follows the bill to its next occurrence.
    await getReminderStore().move(await requireOwnerId(), id, nextId);
  }
  revalidatePath("/", "layout");
  return { id, counterparty: original.counterparty, originalDate: original.date, originalCertainty: original.certainty, nextId };
}

/**
 * Reverses markBillPaid: the payment goes back to an unpaid bill on its
 * original due date, and the auto-created next occurrence is removed. Only
 * touches the signed-in user's own records (the repository is owner-scoped).
 */
export async function undoMarkBillPaid(undo: BillPaidUndo) {
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
    await getReminderStore().move(await requireOwnerId(), next.id, paid.id);
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

export async function createLedgerEntry(formData: FormData): Promise<NotifyResult | null> {
  const ownerId = await requireOwnerId();
  const direction = parseDirection(formData.get("direction"));
  // A saved friend supplies the name, phone and email; otherwise a typed name.
  let friend = getFriend(ownerId, String(formData.get("friendId") || "") || undefined);
  const typedName = String(formData.get("counterparty") || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const typedEmail = String(formData.get("email") || "").trim().toLowerCase();
  const typedPhone = String(formData.get("phone") || "").trim();
  if (!friend && typedEmail) {
    // Someone else with an email: save them as a friend so they can be emailed now and later.
    if (!isValidEmail(typedEmail)) throw new Error("Invalid email address");
    if (!typedName) throw new Error("Enter who this balance is with");
    friend = findOrAddFriend(ownerId, { name: typedName, email: typedEmail, phone: typedPhone || undefined });
  }
  const created = await getFinancialEventRepository().createEvent({
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
    counterparty: friend?.name ?? (typedName || "Unknown"),
    counterpartyPhone: friend?.phone ?? (typedPhone || undefined),
    friendId: friend?.id,
  });
  revalidatePath("/", "layout");
  if (!friend || formData.get("notify") !== "on") return null;
  try {
    return await notifyFriend("added", created);
  } catch (error) {
    console.warn("[settle-up] added email failed:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

export async function deleteLedgerEntry(formData: FormData) {
  await deleteMatching(formData, (e) => e.category === "Repayment" && e.record === "planned", "Ledger entry not found");
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

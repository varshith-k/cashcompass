"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerId } from "@/lib/auth/session";
import { getFinancialEventRepository } from "./repository";
import { getBudgets, setBudgetLimits } from "./budgets";
import { addWishlistGoal, deleteWishlistGoal as removeWishlistGoal } from "./wishlist-goals";
import type { EventDirection, NewFinancialEvent } from "./types";

function parseAmount(raw: FormDataEntryValue | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Amount must be a positive number");
  }
  return Math.round(value * 100) / 100;
}

function parseDirection(raw: FormDataEntryValue | null): EventDirection {
  if (raw === "income" || raw === "expense") return raw;
  throw new Error("Direction must be income or expense");
}

function parseDate(raw: FormDataEntryValue | null): string {
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
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
  revalidatePath("/transactions");
  revalidatePath("/overview");
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id"));
  await getFinancialEventRepository().deleteEvent(id);
  revalidatePath("/transactions");
  revalidatePath("/overview");
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
  revalidatePath("/bills");
  revalidatePath("/overview");
}

export async function deleteBill(formData: FormData) {
  const id = String(formData.get("id"));
  await getFinancialEventRepository().deleteEvent(id);
  revalidatePath("/bills");
  revalidatePath("/overview");
}

export async function markBillPaid(formData: FormData) {
  const id = String(formData.get("id"));
  await getFinancialEventRepository().updateEvent(id, {
    record: "actual",
    date: new Date().toISOString(),
  });
  revalidatePath("/bills");
  revalidatePath("/transactions");
  revalidatePath("/overview");
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
  revalidatePath("/budgets");
}

export async function createWishlistGoal(formData: FormData) {
  const ownerId = await requireOwnerId();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Goal name is required");

  addWishlistGoal(ownerId, {
    name,
    targetAmount: parseAmount(formData.get("targetAmount")),
    targetDate: parseDate(formData.get("targetDate")),
  });
  revalidatePath("/wishlist");
}

export async function deleteWishlistGoal(formData: FormData) {
  const ownerId = await requireOwnerId();
  const id = String(formData.get("id"));
  removeWishlistGoal(ownerId, id);
  revalidatePath("/wishlist");
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
  revalidatePath("/ledger");
  revalidatePath("/overview");
}

export async function deleteLedgerEntry(formData: FormData) {
  const id = String(formData.get("id"));
  await getFinancialEventRepository().deleteEvent(id);
  revalidatePath("/ledger");
  revalidatePath("/overview");
}

export async function logLedgerPayment(formData: FormData) {
  const id = String(formData.get("id"));
  const amountPaid = parseAmount(formData.get("amountPaid"));
  const repo = getFinancialEventRepository();
  const events = await repo.listEvents();
  const original = events.find((event) => event.id === id);
  if (!original) throw new Error("Ledger entry not found");

  const remaining = original.amount;
  if (amountPaid >= remaining) {
    await repo.updateEvent(id, { record: "actual", date: new Date().toISOString(), amount: remaining });
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
      counterparty: original.counterparty,
    });
    await repo.updateEvent(id, { amount: Math.round((remaining - amountPaid) * 100) / 100 });
  }

  revalidatePath("/ledger");
  revalidatePath("/transactions");
  revalidatePath("/overview");
}

export async function addWishlistContribution(formData: FormData) {
  const goalName = String(formData.get("goalName") || "").trim();
  if (!goalName) throw new Error("Missing goal");

  await getFinancialEventRepository().createEvent({
    date: new Date().toISOString(),
    amount: parseAmount(formData.get("amount")),
    direction: "expense",
    record: "actual",
    certainty: "certain",
    recurrence: "one-time",
    source: "manual",
    category: "Savings",
    counterparty: goalName,
  });
  revalidatePath("/wishlist");
  revalidatePath("/overview");
  revalidatePath("/budgets");
}

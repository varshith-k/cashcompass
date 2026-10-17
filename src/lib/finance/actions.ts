"use server";

import { revalidatePath } from "next/cache";
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
  const limits: Record<string, number> = {};
  for (const budget of getBudgets()) {
    const raw = formData.get(`limit_${budget.category}`);
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) {
      limits[budget.category] = Math.round(value * 100) / 100;
    }
  }
  setBudgetLimits(limits);
  revalidatePath("/budgets");
}

export async function createWishlistGoal(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Goal name is required");

  addWishlistGoal({
    name,
    targetAmount: parseAmount(formData.get("targetAmount")),
    targetDate: parseDate(formData.get("targetDate")),
  });
  revalidatePath("/wishlist");
}

export async function deleteWishlistGoal(formData: FormData) {
  const id = String(formData.get("id"));
  removeWishlistGoal(id);
  revalidatePath("/wishlist");
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

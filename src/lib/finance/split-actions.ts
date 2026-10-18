"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerId, requireSession } from "@/lib/auth/session";
import { notifyFriend } from "@/lib/email/notify-friend";
import { EXPENSE_CATEGORIES } from "./categories";
import { findOrAddFriend, getFriend, isValidEmail } from "./friends";
import { getFinancialEventRepository } from "./repository";
import { reconcileShares, validateShares } from "./split";
import { suggestSharesWithGemini, type SplitPerson } from "./split-ai";
import type { FinancialEvent } from "./types";

const MAX_PEOPLE = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date.toISOString();
}

export type SuggestSplitResult =
  | { ok: true; shares: Record<string, number>; items: Record<string, string>; explanation?: string; warning?: string }
  | { ok: false; message: string };

/** Gemini proposes per-person amounts from a natural-language description. Nothing is saved. */
export async function suggestSplit(input: { total: number; merchant: string; people: SplitPerson[]; description: string }): Promise<SuggestSplitResult> {
  await requireSession();
  if (!Number.isFinite(input.total) || input.total <= 0) return { ok: false, message: "Enter the bill total first." };
  const people = (Array.isArray(input.people) ? input.people : []).slice(0, MAX_PEOPLE).filter((p) => typeof p?.key === "string" && typeof p?.name === "string");
  if (people.length < 2) return { ok: false, message: "Choose at least two people." };
  if (typeof input.description !== "string" || input.description.trim().length < 3) return { ok: false, message: "Describe who had what first." };

  const suggestion = await suggestSharesWithGemini({ total: input.total, merchant: String(input.merchant || "the bill"), people, description: input.description });
  if (!suggestion) return { ok: false, message: "AI suggestions aren't available right now. Split equally or enter the amounts yourself." };

  const raw = people.map((p) => suggestion.shares.filter((s) => s.key === p.key).reduce((sum, s) => sum + s.amount, 0));
  const reconciled = reconcileShares(input.total, raw);
  return {
    ok: true,
    shares: Object.fromEntries(people.map((p, i) => [p.key, reconciled.shares[i]!])),
    items: Object.fromEntries(suggestion.shares.filter((s) => s.items).map((s) => [s.key, s.items!])),
    explanation: suggestion.explanation,
    warning: reconciled.warning,
  };
}

export interface SplitParticipantInput {
  key: string;
  kind: "me" | "friend" | "guest";
  friendId?: string;
  name: string;
  email?: string;
  amount: number;
}

export interface CreateSplitInput {
  receiptId?: string;
  newExpense?: { merchant: string; amount: number; date: string; category: string; notes?: string };
  participants: SplitParticipantInput[];
  /** When the others should pay you back (YYYY-MM-DD). */
  dueDate: string;
  notify: boolean;
}

export type CreateSplitResult = { ok: true; created: number; emailed: number; message: string } | { ok: false; message: string };

/**
 * Confirms a split you paid for: the bill is recorded once (an existing
 * receipt, or a new one), and each other person's share becomes a Settle Up
 * balance they owe you, linked to the bill. Shares are re-validated here:
 * they must add up to the bill exactly.
 */
export async function createSplit(input: CreateSplitInput): Promise<CreateSplitResult> {
  const ownerId = await requireOwnerId();
  const repo = getFinancialEventRepository();
  const events = await repo.listEvents();

  const dueDate = validDate(input.dueDate);
  if (!dueDate) return { ok: false, message: "Choose when they should pay you back." };
  const participants = (Array.isArray(input.participants) ? input.participants : []).slice(0, MAX_PEOPLE);
  const others = participants.filter((p) => p.kind !== "me" && p.amount > 0);
  if (others.length === 0) return { ok: false, message: "Add at least one other person with a share." };

  // Check every person before writing anything, so a bad entry never leaves a half-made split.
  const resolved: { person: SplitParticipantInput; name: string; friendId?: string; email?: string }[] = [];
  for (const person of others) {
    const friend = person.kind === "friend" ? getFriend(ownerId, person.friendId) : undefined;
    if (person.kind === "friend" && !friend) return { ok: false, message: `${person.name} isn't in your friends.` };
    const name = friend?.name ?? String(person.name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (!name) return { ok: false, message: "Every person needs a name." };
    const email = friend ? undefined : String(person.email ?? "").trim().toLowerCase() || undefined;
    if (email && !isValidEmail(email)) return { ok: false, message: `${name}'s email doesn't look right.` };
    resolved.push({ person, name, friendId: friend?.id, email });
  }

  // The bill: an existing receipt (its total is authoritative) or a new expense.
  let bill: FinancialEvent | undefined;
  if (input.receiptId) {
    bill = events.find((e) => e.id === input.receiptId && e.isReceipt && e.record === "actual" && e.direction === "expense");
    if (!bill) return { ok: false, message: "That receipt wasn't found." };
    if (events.some((e) => e.sourceRecordId === `split/${bill!.id}`)) return { ok: false, message: "This receipt has already been split." };
  } else {
    const expense = input.newExpense;
    const date = validDate(expense?.date);
    const merchant = String(expense?.merchant ?? "").trim().slice(0, 80);
    if (!expense || !date || !merchant || !Number.isFinite(expense.amount) || expense.amount <= 0) {
      return { ok: false, message: "Enter what the bill was for, its total and date." };
    }
    const shareError = validateShares(expense.amount, participants.map((p) => p.amount));
    if (shareError) return { ok: false, message: shareError };
    const category = (EXPENSE_CATEGORIES as readonly string[]).includes(expense.category) ? expense.category : "Other";
    const notes = String(expense.notes ?? "").trim().slice(0, 500);
    bill = await repo.createEvent({
      date, amount: Math.round(expense.amount * 100) / 100, direction: "expense", record: "actual", certainty: "certain",
      recurrence: "one-time", source: "manual", category, counterparty: merchant, isReceipt: true, ...(notes ? { notes } : {}),
    });
  }

  const shareError = validateShares(bill.amount, participants.map((p) => p.amount));
  if (shareError) return { ok: false, message: shareError };

  let created = 0;
  let emailed = 0;
  for (const { person, name, friendId, email } of resolved) {
    // One-off people with an email are saved as friends so they can be emailed and reminded.
    const friend = friendId ? getFriend(ownerId, friendId) : email ? findOrAddFriend(ownerId, { name, email }) : undefined;

    const balance = await repo.createEvent({
      date: dueDate,
      amount: Math.round(person.amount * 100) / 100,
      direction: "income",
      record: "planned",
      certainty: "uncertain",
      recurrence: "one-time",
      source: "manual",
      category: "Repayment",
      counterparty: friend?.name ?? name,
      ...(friend ? { friendId: friend.id, counterpartyPhone: friend.phone } : {}),
      notes: `Share of ${bill.counterparty} (total ${bill.amount.toFixed(2)})`,
      sourceRecordId: `split/${bill.id}`,
    });
    created++;
    if (input.notify && friend?.email) {
      try {
        const result = await notifyFriend("added", balance);
        if (result.status === "sent") emailed++;
      } catch (error) {
        console.warn("[split] email failed:", error instanceof Error ? error.message : "unknown error");
      }
    }
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    created,
    emailed,
    message: `Split ${bill.counterparty}: ${created} ${created === 1 ? "person owes" : "people owe"} you${emailed ? `, ${emailed} emailed` : ""}.`,
  };
}

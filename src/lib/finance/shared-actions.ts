"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/types";
import { findOrAddFriend } from "./friends";
import { getFinancialEventRepository } from "./repository";
import { getSharedBalanceStore, type SharedBalance } from "./shared-balances";

export type SharedActionResult = { ok: boolean; message: string };

/** Only a balance addressed to the signed-in user's own verified email, still waiting for an answer. */
async function pendingShareFor(user: AuthUser, id: unknown): Promise<SharedBalance | null> {
  if (typeof id !== "string" || !user.emailVerified || !user.email) return null;
  const share = await getSharedBalanceStore().get(id);
  if (!share || share.status !== "pending" || share.toEmail !== user.email.toLowerCase() || share.fromOwnerId === user.id) return null;
  return share;
}

/**
 * Adds a balance someone shared with you to your own Settle Up, linked to
 * theirs: payments logged on either side are mirrored to the other.
 */
export async function acceptSharedBalance(id: string): Promise<SharedActionResult> {
  const { user } = await requireSession();
  const share = await pendingShareFor(user, id);
  if (!share) return { ok: false, message: "That balance is no longer waiting for you." };

  // The sender becomes (or links to) a friend, so the usual reminders and payment options work.
  const friend = await findOrAddFriend(user.id, { name: share.fromName, ...(share.fromEmail ? { email: share.fromEmail } : {}) });
  const youOwe = share.kind === "they_owe_sender";
  const event = await getFinancialEventRepository().createEvent({
    date: share.dueDate,
    amount: share.amount,
    direction: youOwe ? "expense" : "income",
    record: "planned",
    certainty: youOwe ? "certain" : "uncertain",
    recurrence: "one-time",
    source: "manual",
    category: "Repayment",
    counterparty: friend.name,
    friendId: friend.id,
    ...(share.description ? { notes: share.description } : {}),
    sourceRecordId: `shared/${share.id}`,
  });

  // Only the first answer counts, so a double click can't add it twice.
  const claimed = await getSharedBalanceStore().update(share.id, { status: "accepted", toOwnerId: user.id, toEventId: event.id }, "pending");
  if (!claimed) {
    await getFinancialEventRepository().deleteEvent(event.id);
    return { ok: false, message: "That balance was already answered." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `Added to your Settle Up: ${youOwe ? `you owe ${friend.name}` : `${friend.name} owes you`}.` };
}

/** Says the balance isn't yours. Nothing is added to your ledger; the sender sees it was declined. */
export async function declineSharedBalance(id: string): Promise<SharedActionResult> {
  const { user } = await requireSession();
  const share = await pendingShareFor(user, id);
  if (!share) return { ok: false, message: "That balance is no longer waiting for you." };
  await getSharedBalanceStore().update(share.id, { status: "declined" }, "pending");
  revalidatePath("/settle-up");
  return { ok: true, message: "Declined. It won't be added to your Settle Up." };
}

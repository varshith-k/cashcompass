import "server-only";
import { getSession } from "@/lib/auth/session";
import { getFriend } from "@/lib/finance/friends";
import type { FinancialEvent } from "@/lib/finance/types";
import { isEmailConfigured, sendEmail } from "./resend";
import { mailtoLink, settleUpEmail, type SettleUpEmailKind } from "./settle-up-templates";

export type NotifyResult =
  | { status: "sent"; to: string }
  | { status: "not-configured"; to: string; mailto: string }
  | { status: "no-email" }
  | { status: "rate-limited"; to: string }
  | { status: "failed"; to: string; mailto: string };

/** At most one reminder per balance in this window, so the feature can't be used to spam. */
const REMINDER_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const lastReminderAt = new Map<string, number>();

/**
 * Emails the friend linked to a Settle Up entry. Only friends the signed-in
 * user saved can be emailed, and the owner comes from the verified session.
 * Best-effort: callers should never fail the underlying save because of it.
 */
export async function notifyFriend(
  kind: SettleUpEmailKind,
  entry: FinancialEvent,
  extra: { amount?: number; remaining?: number } = {},
): Promise<NotifyResult> {
  const session = await getSession();
  if (!session) return { status: "no-email" };
  const friend = getFriend(session.user.id, entry.friendId);
  if (!friend?.email) return { status: "no-email" };

  const reminderKey = `${session.user.id}:${entry.id}`;
  if (kind === "reminder") {
    const last = lastReminderAt.get(reminderKey);
    if (last && Date.now() - last < REMINDER_COOLDOWN_MS) return { status: "rate-limited", to: friend.email };
  }

  const email = settleUpEmail({
    kind,
    fromName: session.user.name,
    friendName: friend.name,
    amount: extra.amount ?? entry.amount,
    remaining: extra.remaining,
    date: entry.date,
    direction: entry.direction,
  });

  if (!isEmailConfigured()) return { status: "not-configured", to: friend.email, mailto: mailtoLink(friend.email, email) };

  const result = await sendEmail({ to: friend.email, ...email, replyTo: session.user.email || undefined });
  if (!result.ok) return { status: "failed", to: friend.email, mailto: mailtoLink(friend.email, email) };
  if (kind === "reminder") lastReminderAt.set(reminderKey, Date.now());
  return { status: "sent", to: friend.email };
}

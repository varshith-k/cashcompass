import { formatCurrency, formatShortDate } from "@/lib/format";

export type SettleUpEmailKind = "added" | "reminder" | "payment";

export interface SettleUpEmailInput {
  kind: SettleUpEmailKind;
  /** The CashCompass user sending it (their display name). */
  fromName: string;
  friendName: string;
  amount: number;
  /** For "payment": what is still outstanding after it. */
  remaining?: number;
  date: string;
  /** "income": the friend owes the user. "expense": the user owes the friend. */
  direction: "income" | "expense";
}

/**
 * Plain-text Settle Up notifications. Written from the friend's point of
 * view; amounts and dates come from the user's own records, nothing else.
 */
export function settleUpEmail(input: SettleUpEmailInput): { subject: string; text: string } {
  const amount = formatCurrency(input.amount, { cents: true });
  const date = formatShortDate(input.date);
  const friendOwes = input.direction === "income";
  const greeting = `Hi ${firstName(input.friendName)},`;
  const footer = `\n\nSent by ${input.fromName} using CashCompass. Reply to this email to reach ${input.fromName} directly.`;

  if (input.kind === "added") {
    return friendOwes
      ? {
          subject: `${input.fromName} recorded that you owe ${amount}`,
          text: `${greeting}\n\n${input.fromName} recorded in CashCompass that you owe them ${amount}, expected by ${date}.${footer}`,
        }
      : {
          subject: `${input.fromName} recorded that they owe you ${amount}`,
          text: `${greeting}\n\n${input.fromName} recorded in CashCompass that they owe you ${amount}, planned for ${date}.${footer}`,
        };
  }

  if (input.kind === "reminder") {
    return {
      subject: `Friendly reminder: ${amount} for ${input.fromName}`,
      text: `${greeting}\n\nJust a friendly nudge from ${input.fromName}: you owe ${amount}, expected by ${date}. No rush, just keeping things square.${footer}`,
    };
  }

  const remaining = input.remaining ?? 0;
  const status = remaining > 0 ? `${formatCurrency(remaining, { cents: true })} is still outstanding.` : "You're all settled up.";
  return friendOwes
    ? {
        subject: `${input.fromName} logged your payment of ${amount}`,
        text: `${greeting}\n\n${input.fromName} logged a payment of ${amount} from you in CashCompass. ${status}${footer}`,
      }
    : {
        subject: `${input.fromName} paid you ${amount}`,
        text: `${greeting}\n\n${input.fromName} logged a payment of ${amount} to you in CashCompass. ${status}${footer}`,
      };
}

function firstName(name: string) {
  return name.split(/[\s(]/)[0] || name;
}

/** A mailto: link with the same message, for when no email service is configured. */
export function mailtoLink(to: string, email: { subject: string; text: string }) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.text)}`;
}

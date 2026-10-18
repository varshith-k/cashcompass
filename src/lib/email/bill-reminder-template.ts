import { formatCurrency, formatShortDate } from "@/lib/format";

/** Plain-text "your bill is due" reminder, built only from the user's own bill record. */
export function billReminderEmail(input: {
  counterparty: string;
  amount: number;
  category: string;
  minimumPayment?: number;
  dueDate: string;
  daysBefore: number;
  appUrl?: string;
}): { subject: string; text: string } {
  const amount = formatCurrency(input.amount, { cents: true });
  const due = formatShortDate(input.dueDate);
  const isCard = input.category === "Credit card";
  const when = input.daysBefore === 0 ? "today" : input.daysBefore === 1 ? "tomorrow" : `in ${input.daysBefore} days`;
  const what = isCard ? `${input.counterparty} credit card bill` : `${input.counterparty} bill`;

  const lines = [
    `Hi,`,
    ``,
    `Your ${what} of ${amount} is due ${when} (${due}).`,
  ];
  if (isCard && input.minimumPayment) {
    lines.push(
      `The minimum payment is ${formatCurrency(input.minimumPayment, { cents: true })}. Paying only the minimum leaves ${formatCurrency(input.amount - input.minimumPayment, { cents: true })} that may collect interest.`,
    );
  }
  if (input.appUrl) lines.push(``, `Review it in CashCompass: ${input.appUrl.replace(/\/$/, "")}/bills`);
  lines.push(``, `You're getting this because you turned on a reminder for this bill in CashCompass.`);

  return { subject: `Reminder: ${what} ${amount} due ${when === "today" ? "today" : due}`, text: lines.join("\n") };
}

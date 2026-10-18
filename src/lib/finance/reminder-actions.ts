"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { isEmailConfigured } from "@/lib/email/resend";
import { getReminderStore } from "./bill-reminders";
import { isValidEmail } from "./friends";
import { describeReminder, isValidTimeZone, REMINDER_DAY_OPTIONS } from "./reminder-schedule";
import { getFinancialEventRepository } from "./repository";

export type ReminderActionResult = { ok: boolean; message: string };

/**
 * Turns on (or updates) an email reminder for one of the signed-in user's
 * upcoming bills. Emails go to the user's own login email only.
 */
export async function setBillReminder(input: { billId: string; daysBefore: number; hour: number; timeZone: string }): Promise<ReminderActionResult> {
  const session = await requireSession();
  const email = session.user.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) return { ok: false, message: "Your account has no email address to send reminders to." };
  if (!(REMINDER_DAY_OPTIONS as readonly number[]).includes(input.daysBefore)) return { ok: false, message: "Choose when to be reminded." };
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) return { ok: false, message: "Choose a time of day." };
  const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : "UTC";

  const bill = (await getFinancialEventRepository().listEvents()).find(
    (e) => e.id === input.billId && e.record === "planned" && e.direction === "expense" && !["Savings", "Repayment"].includes(e.category),
  );
  if (!bill) return { ok: false, message: "That bill is no longer upcoming." };

  await getReminderStore().upsert(session.user.id, bill.id, { email, daysBefore: input.daysBefore, hour: input.hour, timeZone });
  revalidatePath("/bills");
  const note = isEmailConfigured() ? "" : " (email sending isn't set up on this server yet)";
  return { ok: true, message: `We'll email ${email} ${describeReminder(input.daysBefore, input.hour)}${note}.` };
}

export async function removeBillReminder(billId: string): Promise<ReminderActionResult> {
  const session = await requireSession();
  await getReminderStore().remove(session.user.id, String(billId));
  revalidatePath("/bills");
  return { ok: true, message: "Reminder turned off." };
}

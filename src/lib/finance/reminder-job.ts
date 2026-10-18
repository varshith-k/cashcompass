import "server-only";
import { billReminderEmail } from "@/lib/email/bill-reminder-template";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { getReminderStore } from "./bill-reminders";
import { dateKey } from "./dates";
import { isReminderDue } from "./reminder-schedule";
import { getEventStoreForJobs } from "./repository";
import type { FinancialEvent } from "./types";

export interface ReminderJobResult {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
  disabled?: string;
}

/**
 * Sends every bill reminder whose time has come. Run hourly by a scheduler
 * (see scripts/cashcompass-reminders.*); safe to run more often, since each
 * occurrence is sent at most once (lastSentKey).
 */
export async function runBillReminders(now = Date.now()): Promise<ReminderJobResult> {
  const result: ReminderJobResult = { checked: 0, sent: 0, failed: 0, skipped: 0 };
  if (!isEmailConfigured()) return { ...result, disabled: "RESEND_API_KEY / EMAIL_FROM not set" };

  const reminders = await getReminderStore().listAll();
  const eventsByOwner = new Map<string, FinancialEvent[]>();

  for (const reminder of reminders) {
    result.checked++;
    if (!eventsByOwner.has(reminder.ownerId)) {
      eventsByOwner.set(reminder.ownerId, await getEventStoreForJobs().listEvents(reminder.ownerId));
    }
    const bill = eventsByOwner.get(reminder.ownerId)!.find(
      (e) => e.id === reminder.billId && e.record === "planned" && e.direction === "expense",
    );
    if (!bill) {
      result.skipped++;
      continue;
    }

    const dueDateKey = dateKey(bill.date);
    const occurrenceKey = `${bill.id}:${dueDateKey}`;
    if (!isReminderDue({ dueDateKey, daysBefore: reminder.daysBefore, hour: reminder.hour, timeZone: reminder.timeZone, now, lastSentKey: reminder.lastSentKey, occurrenceKey })) {
      result.skipped++;
      continue;
    }

    const email = billReminderEmail({
      counterparty: bill.counterparty,
      amount: bill.amount,
      category: bill.category,
      minimumPayment: bill.minimumPayment,
      dueDate: bill.date,
      daysBefore: reminder.daysBefore,
      appUrl: process.env.APP_BASE_URL,
    });
    const sent = await sendEmail({ to: reminder.email, ...email });
    if (sent.ok) {
      await getReminderStore().markSent(reminder.id, occurrenceKey);
      result.sent++;
    } else {
      result.failed++;
    }
  }
  return result;
}

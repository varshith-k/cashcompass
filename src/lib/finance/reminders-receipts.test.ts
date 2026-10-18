import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { billReminderEmail } from "@/lib/email/bill-reminder-template";
import { describeReminder, isReminderDue, reminderSendAt } from "./reminder-schedule";

const sent = vi.hoisted(() => ({ messages: [] as { to: string; subject: string; text: string }[], configured: true }));
vi.mock("@/lib/email/resend", () => ({
  isEmailConfigured: () => sent.configured,
  sendEmail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    sent.messages.push(m);
    return { ok: true };
  }),
}));

import { POST as cronPOST } from "@/app/api/public/cron/bill-reminders/route";
import { getReminderStore } from "./bill-reminders";
import { DemoFinancialEventStore } from "./demo-repository";
import { runBillReminders } from "./reminder-job";

describe("reminder scheduling", () => {
  it("converts 'N days before at H o'clock' in the user's time zone to UTC", () => {
    // 9 AM in India (UTC+5:30), 3 days before Nov 10 -> Nov 7 03:30 UTC
    expect(new Date(reminderSendAt("2026-11-10", 3, 9, "Asia/Kolkata")).toISOString()).toBe("2026-11-07T03:30:00.000Z");
    // New York: Nov 2 is after DST ends (UTC-5): 8 AM local -> 13:00 UTC
    expect(new Date(reminderSendAt("2026-11-03", 1, 8, "America/New_York")).toISOString()).toBe("2026-11-02T13:00:00.000Z");
    // ...and before it ends (UTC-4)
    expect(new Date(reminderSendAt("2026-10-20", 0, 8, "America/New_York")).toISOString()).toBe("2026-10-20T12:00:00.000Z");
  });

  it("is due once the send time passes, not before, not twice, and not long after the due date", () => {
    const base = { dueDateKey: "2026-11-10", daysBefore: 3, hour: 9, timeZone: "UTC", occurrenceKey: "b1:2026-11-10" };
    expect(isReminderDue({ ...base, now: Date.parse("2026-11-07T08:59:00Z") })).toBe(false);
    expect(isReminderDue({ ...base, now: Date.parse("2026-11-07T09:00:00Z") })).toBe(true);
    expect(isReminderDue({ ...base, now: Date.parse("2026-11-07T10:00:00Z"), lastSentKey: "b1:2026-11-10" })).toBe(false);
    expect(isReminderDue({ ...base, now: Date.parse("2026-11-13T00:00:00Z") })).toBe(false);
  });

  it("describes the setting for the UI", () => {
    expect(describeReminder(3, 9)).toBe("3 days before at 9 AM");
    expect(describeReminder(0, 18)).toBe("on the due date at 6 PM");
  });
});

describe("bill reminder email", () => {
  it("mentions the minimum payment and interest for credit cards", () => {
    const email = billReminderEmail({ counterparty: "Chase Sapphire", amount: 340, category: "Credit card", minimumPayment: 35, dueDate: "2026-11-10T00:00:00Z", daysBefore: 3, appUrl: "https://cashcompass.club/" });
    expect(email.subject).toBe("Reminder: Chase Sapphire credit card bill $340.00 due Nov 10");
    expect(email.text).toContain("minimum payment is $35.00");
    expect(email.text).toContain("$305.00 that may collect interest");
    expect(email.text).toContain("https://cashcompass.club/bills");
  });
});

describe("reminder job", () => {
  const owner = `auth0|job-${Math.random()}`;
  const events = new DemoFinancialEventStore();
  let billId = "";

  beforeEach(async () => {
    sent.messages = [];
    sent.configured = true;
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + 2);
    const bill = await events.createEvent(owner, {
      date: due.toISOString(), amount: 340, direction: "expense", record: "planned", certainty: "certain",
      recurrence: "recurring", source: "manual", category: "Credit card", counterparty: "Chase Sapphire", minimumPayment: 35,
    });
    billId = bill.id;
  });

  it("sends a due reminder to the user's email exactly once", async () => {
    await getReminderStore().upsert(owner, billId, { email: "me@example.com", daysBefore: 3, hour: 0, timeZone: "UTC" });
    const first = await runBillReminders();
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(sent.messages.some((m) => m.to === "me@example.com" && m.subject.includes("Chase Sapphire"))).toBe(true);

    sent.messages = [];
    await runBillReminders();
    expect(sent.messages.filter((m) => m.subject.includes("Chase Sapphire") && m.to === "me@example.com")).toHaveLength(0);
  });

  it("waits until the chosen time", async () => {
    await getReminderStore().upsert(owner, billId, { email: "later@example.com", daysBefore: 0, hour: 0, timeZone: "UTC" });
    await runBillReminders();
    expect(sent.messages.some((m) => m.to === "later@example.com")).toBe(false);
  });

  it("does nothing when email isn't configured", async () => {
    sent.configured = false;
    expect((await runBillReminders()).disabled).toBeTruthy();
  });
});

describe("cron endpoint", () => {
  afterEach(() => vi.unstubAllEnvs());
  const call = (auth?: string) =>
    cronPOST(new Request("http://localhost/api/public/cron/bill-reminders", { method: "POST", headers: auth ? { authorization: auth } : {} }));

  it("is disabled without CRON_SECRET and rejects a wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer anything")).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-value")).status).toBe(401);
    expect((await call("Bearer s3cret-value")).status).toBe(200);
  });
});

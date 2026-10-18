import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FinancialEvent } from "@/lib/finance/types";

const session = vi.hoisted(() => ({ value: { user: { id: "auth0|ana", name: "Ana Lopez", email: "ana@example.com" }, expiresAt: "", source: "auth0" } as unknown }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session.value, requireOwnerId: async () => "auth0|ana", requireSession: async () => ({ user: { id: "auth0|ana", name: "Ana", email: "ana@example.com" } }) }));

import { notifyFriend } from "./notify-friend";
import { mailtoLink, settleUpEmail } from "./settle-up-templates";
import { addFriend } from "@/lib/finance/friends";

const entry = (overrides: Partial<FinancialEvent> = {}): FinancialEvent => ({
  id: crypto.randomUUID(),
  date: "2026-10-30T00:00:00.000Z",
  amount: 42.5,
  direction: "income",
  record: "planned",
  certainty: "uncertain",
  recurrence: "one-time",
  source: "manual",
  category: "Repayment",
  counterparty: "Sam (roommate)",
  friendId: "friend-sam",
  ...overrides,
});

describe("settle-up email wording", () => {
  it("is written from the friend's side for each kind", () => {
    const base = { fromName: "Ana Lopez", friendName: "Sam (roommate)", amount: 42.5, date: "2026-10-30T00:00:00.000Z" };
    expect(settleUpEmail({ ...base, kind: "added", direction: "income" }).subject).toBe("Ana Lopez recorded that you owe $42.50");
    expect(settleUpEmail({ ...base, kind: "added", direction: "expense" }).subject).toBe("Ana Lopez recorded that they owe you $42.50");
    expect(settleUpEmail({ ...base, kind: "reminder", direction: "income" }).text).toMatch(/^Hi Sam,/);
    expect(settleUpEmail({ ...base, kind: "payment", direction: "income", remaining: 10 }).text).toContain("$10.00 is still outstanding");
    expect(settleUpEmail({ ...base, kind: "payment", direction: "expense", remaining: 0 }).text).toContain("all settled up");
  });

  it("builds an encoded mailto fallback", () => {
    expect(mailtoLink("sam@example.com", { subject: "Hi & bye", text: "a b" })).toBe("mailto:sam%40example.com?subject=Hi%20%26%20bye&body=a%20b");
  });
});

describe("notifyFriend", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("offers a mailto link instead of sending when Resend isn't configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const result = await notifyFriend("added", entry());
    expect(result).toMatchObject({ status: "not-configured", to: "sam@example.com" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends through Resend to the saved friend, with the user as reply-to", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "CashCompass <notify@cashcompass.club>");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await notifyFriend("added", entry())).toEqual({ status: "sent", to: "sam@example.com" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toMatchObject({ to: ["sam@example.com"], reply_to: "ana@example.com", from: "CashCompass <notify@cashcompass.club>" });
  });

  it("rate-limits reminders for the same balance", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "CashCompass <notify@cashcompass.club>");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const balance = entry();
    expect((await notifyFriend("reminder", balance)).status).toBe("sent");
    expect((await notifyFriend("reminder", balance)).status).toBe("rate-limited");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a failed send with a mailto fallback", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "CashCompass <notify@cashcompass.club>");
    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    expect((await notifyFriend("added", entry())).status).toBe("failed");
  });

  it("never emails anyone who isn't a saved friend with an email", async () => {
    expect((await notifyFriend("added", entry({ friendId: undefined }))).status).toBe("no-email");
    expect((await notifyFriend("added", entry({ friendId: "someone-elses-friend" }))).status).toBe("no-email");
    const noEmail = await addFriend("auth0|ana", { name: "No Email Nia" });
    expect((await notifyFriend("added", entry({ friendId: noEmail.id }))).status).toBe("no-email");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/lib/auth/types";

const auth = vi.hoisted(() => ({ user: null as unknown as AuthUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email/notify-friend", () => ({ notifyFriend: vi.fn(async () => ({ status: "skipped" })) }));
vi.mock("@/lib/auth/session", () => ({
  requireOwnerId: async () => auth.user.id,
  requireSession: async () => ({ user: auth.user, source: "auth0" }),
}));

import { createLedgerEntry, deleteLedgerEntry } from "./actions";
import { settleLedgerAmount } from "./ledger";
import { getEventStoreForJobs } from "./repository";
import { acceptSharedBalance, declineSharedBalance } from "./shared-actions";
import { getSharedBalanceStore } from "./shared-balances";

let run = 0;
let ana: AuthUser;
let ben: AuthUser;

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

/** Ana records that Ben owes her $40, typing Ben's email. */
async function anaRecordsBenOwes(amount = "40") {
  auth.user = ana;
  await createLedgerEntry(form({ direction: "income", counterparty: "Ben", email: ben.email, amount, date: "2026-10-25" }));
  const share = (await getSharedBalanceStore().listPendingFor(ben.email)).find((s) => s.fromOwnerId === ana.id);
  return share!;
}

const ledger = async (user: AuthUser) => (await getEventStoreForJobs().listEvents(user.id)).filter((e) => e.category === "Repayment");

beforeEach(() => {
  run++;
  ana = { id: `auth0|ana-${run}`, name: "Ana", email: `ana-${run}@example.com`, emailVerified: true };
  ben = { id: `google-oauth2|ben-${run}`, name: "Ben", email: `ben-${run}@example.com`, emailVerified: true };
});

describe("shared balances", () => {
  it("shows a balance to the other person, and only adds it to their ledger when they accept", async () => {
    const share = await anaRecordsBenOwes();
    expect(share).toMatchObject({ fromName: "Ana", kind: "they_owe_sender", amount: 40, status: "pending" });
    const benBefore = (await ledger(ben)).length;

    auth.user = ben;
    expect(await acceptSharedBalance(share.id)).toMatchObject({ ok: true });
    const added = (await ledger(ben)).find((e) => e.sourceRecordId === `shared/${share.id}`);
    expect(added).toMatchObject({ direction: "expense", record: "planned", amount: 40, counterparty: "Ana" });
    expect((await ledger(ben)).length).toBe(benBefore + 1);
    expect((await getSharedBalanceStore().get(share.id))?.status).toBe("accepted");

    // A second answer is refused.
    expect((await acceptSharedBalance(share.id)).ok).toBe(false);
  });

  it("mirrors payments both ways once accepted", async () => {
    const share = await anaRecordsBenOwes("40");
    auth.user = ben;
    await acceptSharedBalance(share.id);
    const benEntry = (await ledger(ben)).find((e) => e.sourceRecordId === `shared/${share.id}`)!;

    // Ben pays $15 of it: Ana's balance drops to $25 too.
    await settleLedgerAmount(benEntry.id, 15);
    const anaEntry = (await ledger(ana)).find((e) => e.id === share.fromEventId)!;
    expect(anaEntry).toMatchObject({ record: "planned", amount: 25 });

    // Ana logs the rest: both sides are settled.
    auth.user = ana;
    await settleLedgerAmount(anaEntry.id, 25);
    expect((await ledger(ana)).find((e) => e.id === share.fromEventId)?.record).toBe("actual");
    expect((await ledger(ben)).find((e) => e.id === benEntry.id)?.record).toBe("actual");
    expect((await getSharedBalanceStore().get(share.id))?.status).toBe("settled");
  });

  it("only the verified owner of that email can answer", async () => {
    const share = await anaRecordsBenOwes();
    auth.user = { ...ben, emailVerified: false };
    expect((await acceptSharedBalance(share.id)).ok).toBe(false);
    auth.user = { id: "auth0|mallory", name: "Mallory", email: "mallory@example.com", emailVerified: true };
    expect((await acceptSharedBalance(share.id)).ok).toBe(false);
    expect((await declineSharedBalance(share.id)).ok).toBe(false);
    expect((await getSharedBalanceStore().get(share.id))?.status).toBe("pending");
  });

  it("declining adds nothing, and deleting withdraws an unanswered share", async () => {
    const declined = await anaRecordsBenOwes("10");
    const benBefore = (await ledger(ben)).length;
    auth.user = ben;
    expect((await declineSharedBalance(declined.id)).ok).toBe(true);
    expect((await ledger(ben)).length).toBe(benBefore);
    expect((await getSharedBalanceStore().get(declined.id))?.status).toBe("declined");

    const withdrawn = await anaRecordsBenOwes("20");
    auth.user = ana;
    await deleteLedgerEntry(form({ id: withdrawn.fromEventId }));
    expect((await getSharedBalanceStore().listPendingFor(ben.email)).some((s) => s.id === withdrawn.id)).toBe(false);
  });

  it("isn't shared when there's no email, or it's your own", async () => {
    auth.user = ana;
    await createLedgerEntry(form({ direction: "income", counterparty: "No Email Ned", amount: "5", date: "2026-10-25" }));
    await createLedgerEntry(form({ direction: "expense", counterparty: "Me Again", email: ana.email, amount: "5", date: "2026-10-25" }));
    expect(await getSharedBalanceStore().listSentBy(ana.id)).toHaveLength(0);
  });
});

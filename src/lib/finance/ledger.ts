import "server-only";
import { revalidatePath } from "next/cache";
import { requireOwnerId } from "@/lib/auth/session";
import { notifyFriend } from "@/lib/email/notify-friend";
import { getEventStoreForJobs, getFinancialEventRepository, withFinancialTransaction } from "./repository";
import { getSharedBalanceStore } from "./shared-balances";
import type { FinancialEvent, FinancialEventUpdate, NewFinancialEvent } from "./types";

interface LedgerWriter {
  createEvent(input: NewFinancialEvent): Promise<FinancialEvent>;
  updateEvent(id: string, patch: FinancialEventUpdate): Promise<FinancialEvent>;
}

/**
 * Server-only helper, never a client-callable Server Action.
 * Settles (fully or partially) a ledger entry by id. Shared by the manual
 * "Log payment" action and the Solana devnet settlement flow in
 * src/lib/solana/actions.ts, so both record the repayment the same way.
 */
export async function settleLedgerAmount(
  id: string,
  amountPaid: number,
  options?: {
    counterpartyNote?: string;
    /** Nessie transfer key (`<account>/transfer/<id>`), so the next sync matches instead of duplicating. */
    sourceRecordId?: string;
  },
) {
  const payment = await withFinancialTransaction(async () => {
  const repo = getFinancialEventRepository();
  const events = await repo.listEvents();
  const original = events.find((event) => event.id === id);
  if (!original || original.category !== "Repayment" || original.record !== "planned") {
    throw new Error("Outstanding ledger entry not found");
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0.01 || amountPaid > original.amount) {
    throw new Error("Payment must be positive and cannot exceed the outstanding amount");
  }
  amountPaid = Math.round(amountPaid * 100) / 100;

  const remaining = original.amount;
  await applyLedgerPayment(repo, original, amountPaid, options);
  return { original, amountPaid, remaining };
  });
  const { original, remaining } = payment;
  amountPaid = payment.amountPaid;
  await mirrorSharedPayment(await requireOwnerId(), original.id, amountPaid, amountPaid >= remaining);

  revalidatePath("/", "layout");

  // Let the friend know (best-effort: an email problem never undoes the payment).
  try {
    await notifyFriend("payment", original, { amount: amountPaid, remaining: Math.max(0, Math.round((remaining - amountPaid) * 100) / 100) });
  } catch (error) {
    console.warn("[settle-up] payment email failed:", error instanceof Error ? error.message : "unknown error");
  }
}

/** Records a payment against an open ledger entry: settles it, or reduces it and logs the partial payment. */
async function applyLedgerPayment(
  writer: LedgerWriter,
  original: FinancialEvent,
  amountPaid: number,
  options?: { counterpartyNote?: string; sourceRecordId?: string },
) {
  const remaining = original.amount;
  const counterparty = options?.counterpartyNote ? `${original.counterparty} (${options.counterpartyNote})` : original.counterparty;

  if (amountPaid >= remaining) {
    await writer.updateEvent(original.id, {
      record: "actual",
      certainty: "certain",
      date: new Date().toISOString(),
      amount: remaining,
      counterparty,
      ...(options?.sourceRecordId ? { sourceRecordId: options.sourceRecordId, source: "nessie" as const } : {}),
    });
  } else {
    await writer.createEvent({
      date: new Date().toISOString(),
      amount: amountPaid,
      direction: original.direction,
      record: "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "manual",
      category: "Repayment",
      counterparty,
      // Links each partial payment to the ledger entry it reduces.
      sourceRecordId: options?.sourceRecordId ?? `ledger/${original.id}`,
      friendId: original.friendId,
    });
    await writer.updateEvent(original.id, { amount: Math.round((remaining - amountPaid) * 100) / 100 });
  }
}

/**
 * If the entry is a balance shared with another CashCompass user (and they
 * accepted it), records the same payment in their copy. Trusted server code:
 * the other owner comes from the share record, never from the request.
 */
async function mirrorSharedPayment(ownerId: string, eventId: string, amountPaid: number, settled: boolean) {
  try {
    const shares = getSharedBalanceStore();
    const share = await shares.findByEvent(ownerId, eventId);
    if (!share || share.status !== "accepted" || !share.toOwnerId || !share.toEventId) return;
    const sender = share.fromOwnerId === ownerId;
    const otherOwner = sender ? share.toOwnerId : share.fromOwnerId;
    const otherEventId = sender ? share.toEventId : share.fromEventId;

    const store = getEventStoreForJobs();
    const other = (await store.listEvents(otherOwner)).find((e) => e.id === otherEventId && e.category === "Repayment" && e.record === "planned");
    if (other) {
      const writer: LedgerWriter = {
        createEvent: (input) => store.createEvent(otherOwner, input),
        updateEvent: (id, patch) => store.updateEvent(otherOwner, id, patch),
      };
      await applyLedgerPayment(writer, other, settled ? other.amount : Math.min(amountPaid, other.amount));
    }
    if (settled) await shares.update(share.id, { status: "settled" });
  } catch (error) {
    console.warn("[shared] couldn't mirror payment:", error instanceof Error ? error.message : "unknown error");
  }
}

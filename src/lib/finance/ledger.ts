import "server-only";
import { revalidatePath } from "next/cache";
import { getFinancialEventRepository } from "./repository";

/**
 * Server-only helper, never a client-callable Server Action.
 * Settles (fully or partially) a ledger entry by id. Shared by the manual
 * "Log payment" action and the Solana devnet settlement flow in
 * src/lib/solana/actions.ts, so both record the repayment the same way.
 */
export async function settleLedgerAmount(
  id: string,
  amountPaid: number,
  options?: { counterpartyNote?: string },
) {
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
  const counterparty = options?.counterpartyNote
    ? `${original.counterparty} (${options.counterpartyNote})`
    : original.counterparty;

  if (amountPaid >= remaining) {
    await repo.updateEvent(id, { record: "actual", certainty: "certain", date: new Date().toISOString(), amount: remaining, counterparty });
  } else {
    await repo.createEvent({
      date: new Date().toISOString(),
      amount: amountPaid,
      direction: original.direction,
      record: "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "manual",
      category: "Repayment",
      counterparty,
    });
    await repo.updateEvent(id, { amount: Math.round((remaining - amountPaid) * 100) / 100 });
  }

  revalidatePath("/", "layout");
}

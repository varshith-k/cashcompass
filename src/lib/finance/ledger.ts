import "server-only";
import { revalidatePath } from "next/cache";
import { getFinancialEventRepository } from "./repository";

/**
 * Settles (fully or partially) a ledger entry by id. Shared by the manual
 * "Log payment" action and the Solana devnet settlement flow in
 * src/lib/solana/actions.ts, so both record the repayment the same way.
 *
 * Deliberately NOT in actions.ts: every export of a "use server" file is a
 * client-callable endpoint, and this must only run behind those actions'
 * checks (form validation, on-chain verification). Writes are scoped to the
 * signed-in user by the repository.
 */
export async function settleLedgerAmount(
  id: string,
  amountPaid: number,
  options?: { counterpartyNote?: string },
) {
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    throw new Error("Amount paid must be a positive number");
  }

  const repo = getFinancialEventRepository();
  const events = await repo.listEvents();
  const original = events.find((event) => event.id === id);
  if (!original) throw new Error("Ledger entry not found");

  const remaining = original.amount;
  const counterparty = options?.counterpartyNote
    ? `${original.counterparty} (${options.counterpartyNote})`
    : original.counterparty;

  if (amountPaid >= remaining) {
    await repo.updateEvent(id, { record: "actual", date: new Date().toISOString(), amount: remaining, counterparty });
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

  revalidatePath("/ledger");
  revalidatePath("/transactions");
  revalidatePath("/overview");
}

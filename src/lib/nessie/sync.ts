import "server-only";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import type { FinancialEvent, NewFinancialEvent } from "@/lib/finance/types";
import {
  getAccount,
  getAccountBills,
  getAccountDeposits,
  getAccountPurchases,
  getAccountTransfers,
  getAccountWithdrawals,
  getMerchant,
} from "./client";
import { categorizeExpense } from "./categorize";

/** Stable remote ids preserve separate identical purchases. Natural keys migrate old imports. */
function findExisting(existing: FinancialEvent[], candidate: NewFinancialEvent): FinancialEvent | undefined {
  const byId = candidate.sourceRecordId ? existing.find((event) => event.sourceRecordId === candidate.sourceRecordId) : undefined;
  if (byId) return byId;
  return existing.find(
    (event) =>
      !event.sourceRecordId && event.source === "nessie" &&
      event.date === candidate.date &&
      event.amount === candidate.amount &&
      event.counterparty === candidate.counterparty,
  );
}

/** Friends that may own the other side of a P2P transfer. */
export interface TransferFriend {
  id: string;
  name: string;
  nessieAccountId?: string;
}

export async function syncNessieAccount(accountId: string, options: { friends?: TransferFriend[] } = {}) {
  const repo = getFinancialEventRepository();
  const existing = await repo.listEvents();

  const [account, purchases, deposits, withdrawals, bills, transfers] = await Promise.all([
    getAccount(accountId),
    getAccountPurchases(accountId),
    getAccountDeposits(accountId),
    getAccountWithdrawals(accountId),
    getAccountBills(accountId),
    getAccountTransfers(accountId),
  ]);

  const merchants = new Map<string, { name: string; category?: string[] | string }>();
  async function merchantInfo(merchantId: string) {
    if (!merchants.has(merchantId)) {
      try {
        const merchant = await getMerchant(merchantId);
        merchants.set(merchantId, { name: merchant.name, category: merchant.category });
      } catch {
        merchants.set(merchantId, { name: "Merchant" });
      }
    }
    return merchants.get(merchantId)!;
  }

  const candidates: NewFinancialEvent[] = [];

  for (const purchase of purchases) {
    if (["cancelled", "canceled", "failed"].includes(purchase.status ?? "")) continue;
    const merchant = await merchantInfo(purchase.merchant_id);
    candidates.push({
      sourceRecordId: `${accountId}/purchase/${purchase._id}`,
      date: new Date(purchase.purchase_date).toISOString(),
      amount: purchase.amount,
      direction: "expense",
      // A pending card purchase is money already committed, not a bill to pay later.
      record: "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "nessie",
      category: categorizeExpense(merchant.category, merchant.name, purchase.description),
      counterparty: merchant.name,
    });
  }

  for (const deposit of deposits) {
    if (["cancelled", "canceled", "failed"].includes(deposit.status ?? "")) continue;
    candidates.push({
      sourceRecordId: `${accountId}/deposit/${deposit._id}`,
      date: new Date(deposit.transaction_date).toISOString(),
      amount: deposit.amount,
      direction: "income",
      record: deposit.status === "pending" ? "planned" : "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "nessie",
      category: "Deposit",
      counterparty: deposit.description || "Deposit",
    });
  }

  for (const withdrawal of withdrawals) {
    if (["cancelled", "canceled", "failed"].includes(withdrawal.status ?? "")) continue;
    candidates.push({
      sourceRecordId: `${accountId}/withdrawal/${withdrawal._id}`,
      date: new Date(withdrawal.transaction_date).toISOString(),
      amount: withdrawal.amount,
      direction: "expense",
      record: "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "nessie",
      category: categorizeExpense(withdrawal.description),
      counterparty: withdrawal.description || "Withdrawal",
    });
  }

  for (const bill of bills) {
    if (["cancelled", "canceled", "failed"].includes(bill.status ?? "")) continue;
    candidates.push({
      sourceRecordId: `${accountId}/bill/${bill._id}`,
      date: new Date(bill.payment_date).toISOString(),
      amount: bill.payment_amount,
      direction: "expense",
      record: bill.status === "completed" ? "actual" : "planned",
      certainty: "certain",
      recurrence: bill.recurring_date ? "recurring" : "one-time",
      source: "nessie",
      category: categorizeExpense(bill.payee, bill.nickname) === "Other" ? "Utilities" : categorizeExpense(bill.payee, bill.nickname),
      counterparty: bill.payee || bill.nickname,
    });
  }

  // Peer-to-peer transfers: money sent to / received from another account.
  // Filed as settle-up payments (category Repayment), linked to the friend who
  // owns the other account when known.
  const accountNames = new Map<string, string>();
  async function otherAccountName(otherId: string): Promise<string> {
    if (!accountNames.has(otherId)) {
      try {
        accountNames.set(otherId, (await getAccount(otherId)).nickname || `Nessie account ••${otherId.slice(-4)}`);
      } catch {
        accountNames.set(otherId, `Nessie account ••${otherId.slice(-4)}`);
      }
    }
    return accountNames.get(otherId)!;
  }
  for (const transfer of transfers) {
    if (["cancelled", "canceled", "failed"].includes(transfer.status ?? "")) continue;
    const outgoing = transfer.payer_id === accountId;
    const otherId = outgoing ? transfer.payee_id : transfer.payer_id;
    const friend = options.friends?.find((f) => f.nessieAccountId && f.nessieAccountId === otherId);
    candidates.push({
      sourceRecordId: `${accountId}/transfer/${transfer._id}`,
      date: new Date(transfer.transaction_date).toISOString(),
      amount: transfer.amount,
      direction: outgoing ? "expense" : "income",
      record: "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "nessie",
      category: "Repayment",
      counterparty: friend?.name ?? (await otherAccountName(otherId)),
      ...(friend ? { friendId: friend.id } : {}),
    });
  }

  if (candidates.some((candidate) => !Number.isFinite(candidate.amount) || candidate.amount <= 0)) throw new Error("Nessie returned an invalid amount. No guessed records were imported.");
  let added = 0;
  let skipped = 0;
  let updated = 0;
  for (const candidate of candidates) {
    const previous = findExisting(existing, candidate);
    if (previous) {
      if (Object.entries(candidate).some(([key, value]) => previous[key as keyof FinancialEvent] !== value)) {
        await repo.updateEvent(previous.id, candidate);
        updated++;
      } else skipped++;
      continue;
    }
    const created = await repo.createEvent(candidate);
    existing.push(created);
    added++;
  }
  return { added, skipped, updated, accountId: account._id, accountName: account.nickname, accountBalance: account.balance };
}

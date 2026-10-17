import "server-only";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import type { FinancialEvent, NewFinancialEvent } from "@/lib/finance/types";
import {
  getAccount,
  getAccountBills,
  getAccountDeposits,
  getAccountPurchases,
  getAccountWithdrawals,
  getMerchant,
} from "./client";

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

export async function syncNessieAccount(accountId: string) {
  const repo = getFinancialEventRepository();
  const existing = await repo.listEvents();

  const [account, purchases, deposits, withdrawals, bills] = await Promise.all([
    getAccount(accountId),
    getAccountPurchases(accountId),
    getAccountDeposits(accountId),
    getAccountWithdrawals(accountId),
    getAccountBills(accountId),
  ]);

  const merchantNames = new Map<string, string>();
  async function merchantName(merchantId: string): Promise<string> {
    if (!merchantNames.has(merchantId)) {
      try {
        const merchant = await getMerchant(merchantId);
        merchantNames.set(merchantId, merchant.name);
      } catch {
        merchantNames.set(merchantId, "Merchant");
      }
    }
    return merchantNames.get(merchantId)!;
  }

  const candidates: NewFinancialEvent[] = [];

  for (const purchase of purchases) {
    if (["cancelled", "canceled", "failed"].includes(purchase.status ?? "")) continue;
    candidates.push({
      sourceRecordId: `${accountId}/purchase/${purchase._id}`,
      date: new Date(purchase.purchase_date).toISOString(),
      amount: purchase.amount,
      direction: "expense",
      record: purchase.status === "pending" ? "planned" : "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "nessie",
      category: "Other",
      counterparty: await merchantName(purchase.merchant_id),
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
      record: withdrawal.status === "pending" ? "planned" : "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "nessie",
      category: "Other",
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
      category: "Utilities",
      counterparty: bill.payee || bill.nickname,
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

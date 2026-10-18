import "server-only";
import { updatePlanningProfile } from "@/lib/storage/profile";
import { getFinancialEventRepository, withFinancialTransaction } from "@/lib/finance/repository";
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

  const cancelled = new Set([
    ...purchases.filter((item) => ["cancelled", "canceled", "failed"].includes(item.status)).map((item) => `${accountId}/purchase/${item._id}`),
    ...deposits.filter((item) => ["cancelled", "canceled", "failed"].includes(item.status ?? "")).map((item) => `${accountId}/deposit/${item._id}`),
    ...withdrawals.filter((item) => ["cancelled", "canceled", "failed"].includes(item.status ?? "")).map((item) => `${accountId}/withdrawal/${item._id}`),
    ...bills.filter((item) => ["cancelled", "canceled", "failed"].includes(item.status)).map((item) => `${accountId}/bill/${item._id}`),
  ]);
  if (account._id !== accountId || !Number.isFinite(account.balance)) throw new Error("Nessie returned invalid account data");
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

  if (candidates.some((candidate) => !Number.isFinite(candidate.amount) || candidate.amount <= 0 || candidate.amount > 9999999999.99 || !candidate.sourceRecordId || candidate.sourceRecordId.endsWith("/undefined"))) throw new Error("Nessie returned an invalid amount. No guessed records were imported.");
  return withFinancialTransaction(async (ownerId) => {
    const existing = await repo.listEvents();
    let added = 0;
    let skipped = 0;
    let updated = 0;
    for (let index = existing.length - 1; index >= 0; index--) {
      const event = existing[index];
      if (event.sourceRecordId && cancelled.has(event.sourceRecordId)) {
        await repo.deleteEvent(event.id);
        existing.splice(index, 1);
        updated++;
      }
    }
    for (const candidate of candidates) {
      const previous = findExisting(existing, candidate);
      if (previous) {
        if (Object.entries(candidate).some(([key, value]) => previous[key as keyof FinancialEvent] !== value)) {
          const updatedEvent = await repo.updateEvent(previous.id, candidate);
          existing[existing.findIndex((event) => event.id === previous.id)] = updatedEvent;
          updated++;
        } else skipped++;
        continue;
      }
      const created = await repo.createEvent(candidate);
      existing.push(created);
      added++;
    }
    const result = { added, skipped, updated, accountId: account._id, accountName: account.nickname, accountBalance: account.balance };
    if (!Number.isFinite(account.balance)) throw new Error("Nessie returned an invalid account balance");
    await updatePlanningProfile(ownerId, (profile) => {
      const reflectedEvents = Object.fromEntries(existing.filter((event) => event.sourceRecordId?.startsWith(`${accountId}/`) && event.record === "actual" && event.date.slice(0, 10) <= new Date().toISOString().slice(0, 10)).map((event) => [event.id, event.direction === "income" ? event.amount : -event.amount]));
      profile.accountSnapshots[accountId] = { balance: account.balance, timestamp: new Date().toISOString(), reflectedEvents };
      profile.openingBalance = null;
      profile.syncStatus = { ...result, timestamp: new Date().toISOString() };
    });
    return result;
  });
}

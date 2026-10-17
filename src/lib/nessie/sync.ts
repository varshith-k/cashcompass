import "server-only";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import type { FinancialEvent, NewFinancialEvent } from "@/lib/finance/types";
import {
  getAccountBills,
  getAccountDeposits,
  getAccountPurchases,
  getAccountWithdrawals,
  getMerchant,
} from "./client";

/**
 * Natural-key duplicate check (source + date + amount + counterparty)
 * rather than a caller-supplied id, so re-syncing the same account never
 * doubles up a transaction — the doc's "avoid duplicate records during
 * synchronization" requirement.
 */
function isDuplicate(existing: FinancialEvent[], candidate: NewFinancialEvent): boolean {
  return existing.some(
    (event) =>
      event.source === "nessie" &&
      event.date === candidate.date &&
      event.amount === candidate.amount &&
      event.counterparty === candidate.counterparty,
  );
}

export async function syncNessieAccount(accountId: string): Promise<{ added: number; skipped: number }> {
  const repo = getFinancialEventRepository();
  const existing = await repo.listEvents();

  const [purchases, deposits, withdrawals, bills] = await Promise.all([
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
    candidates.push({
      date: new Date(purchase.purchase_date).toISOString(),
      amount: purchase.amount,
      direction: "expense",
      record: "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "nessie",
      category: "Other",
      counterparty: await merchantName(purchase.merchant_id),
    });
  }

  for (const deposit of deposits) {
    candidates.push({
      date: new Date(deposit.transaction_date).toISOString(),
      amount: deposit.amount,
      direction: "income",
      record: "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "nessie",
      category: "Deposit",
      counterparty: deposit.description || "Deposit",
    });
  }

  for (const withdrawal of withdrawals) {
    candidates.push({
      date: new Date(withdrawal.transaction_date).toISOString(),
      amount: withdrawal.amount,
      direction: "expense",
      record: "actual",
      certainty: "certain",
      recurrence: "one-time",
      source: "nessie",
      category: "Other",
      counterparty: withdrawal.description || "Withdrawal",
    });
  }

  for (const bill of bills) {
    candidates.push({
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

  let added = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (isDuplicate(existing, candidate)) {
      skipped++;
      continue;
    }
    const created = await repo.createEvent(candidate);
    existing.push(created);
    added++;
  }

  return { added, skipped };
}

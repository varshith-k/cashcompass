"use server";

import { requireOwnerId } from "@/lib/auth/session";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { claimSettlement, releaseSettlement } from "./receipts";
import { settleLedgerAmount } from "@/lib/finance/ledger";
import { SOLANA_DEMO_RECIPIENT, usdToLamports } from "./config";
import { verifySolanaTransfer } from "./verify";
import type { SolanaPaymentVerification } from "./types";

/**
 * Called from the client after the wallet has signed and sent the devnet
 * transfer. Re-verifies the signature on-chain before touching the ledger —
 * never trusts the amount the client claims to have sent.
 */
export async function settleLedgerWithSolana(
  ledgerEntryId: string,
  amountOwedUsd: number,
  signature: string,
): Promise<SolanaPaymentVerification> {
  const ownerId = await requireOwnerId();
  if (!ledgerEntryId || !signature) {
    throw new Error("Missing ledger entry or transaction signature");
  }
  if (!Number.isFinite(amountOwedUsd) || amountOwedUsd <= 0) {
    throw new Error("Amount owed must be a positive number");
  }

  const original = (await getFinancialEventRepository().listEvents()).find((event) => event.id === ledgerEntryId);
  if (!original || original.record !== "planned" || original.category !== "Repayment" || original.direction !== "expense") throw new Error("Outstanding payable ledger entry not found");
  if (amountOwedUsd > original.amount) throw new Error("Payment exceeds the outstanding amount");
  const expectedLamports = usdToLamports(amountOwedUsd);
  const result = await verifySolanaTransfer(signature, SOLANA_DEMO_RECIPIENT, expectedLamports);

  if (!result.verified) {
    return result;
  }

  if (!await claimSettlement(signature, ownerId, ledgerEntryId)) {
    return { ...result, verified: false, reason: "This transaction has already been used for a settlement" };
  }
  try {
    await settleLedgerAmount(ledgerEntryId, amountOwedUsd, { counterpartyNote: `Solana devnet · ${signature.slice(0, 8)}…` });
  } catch (error) {
    await releaseSettlement(signature, ownerId);
    throw error;
  }

  return result;
}

"use server";

import { settleLedgerAmount } from "@/lib/finance/actions";
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
  if (!ledgerEntryId || !signature) {
    throw new Error("Missing ledger entry or transaction signature");
  }
  if (!Number.isFinite(amountOwedUsd) || amountOwedUsd <= 0) {
    throw new Error("Amount owed must be a positive number");
  }

  const expectedLamports = usdToLamports(amountOwedUsd);
  const result = await verifySolanaTransfer(signature, SOLANA_DEMO_RECIPIENT, expectedLamports);

  if (!result.verified) {
    return result;
  }

  await settleLedgerAmount(ledgerEntryId, amountOwedUsd, {
    counterpartyNote: `Solana devnet · ${signature.slice(0, 8)}…`,
  });

  return result;
}

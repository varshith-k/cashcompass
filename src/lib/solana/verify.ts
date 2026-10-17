import { Connection, type ParsedInstruction } from "@solana/web3.js";
import { SOLANA_RPC_ENDPOINT, explorerUrl } from "./config";
import type { SolanaPaymentVerification } from "./types";

const connection = new Connection(SOLANA_RPC_ENDPOINT, "confirmed");

/**
 * Re-derives the transfer from the chain instead of trusting whatever
 * amount/recipient the client reports — the client only ever hands us a
 * signature, never a verified result.
 */
export async function verifySolanaTransfer(
  signature: string,
  expectedRecipient: string,
  expectedLamports: number,
): Promise<SolanaPaymentVerification> {
  const base = {
    signature,
    recipient: expectedRecipient,
    lamports: expectedLamports,
    explorerUrl: explorerUrl(signature),
  };

  const status = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });
  if (!status.value || status.value.err) {
    return { ...base, verified: false, slot: 0, reason: "Transaction not found or failed on-chain" };
  }

  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) {
    return { ...base, verified: false, slot: status.value.slot, reason: "Transaction details unavailable" };
  }

  const transferIx = tx.transaction.message.instructions.find(
    (ix): ix is ParsedInstruction =>
      "parsed" in ix && ix.program === "system" && ix.parsed?.type === "transfer",
  );

  if (!transferIx) {
    return { ...base, verified: false, slot: status.value.slot, reason: "No SOL transfer instruction found in that transaction" };
  }

  const info = transferIx.parsed.info as { destination: string; lamports: number };

  if (info.destination !== expectedRecipient) {
    return { ...base, verified: false, slot: status.value.slot, reason: "Recipient does not match the settlement address" };
  }

  if (info.lamports < expectedLamports) {
    return { ...base, verified: false, slot: status.value.slot, reason: "Transferred amount is less than the amount owed" };
  }

  return { ...base, verified: true, lamports: info.lamports, slot: status.value.slot };
}

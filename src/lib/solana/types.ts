export interface SolanaPaymentRequest {
  /** Base58 devnet address the payer sends to. */
  recipient: string;
  lamports: number;
  /** Ledger entry id this payment is expected to settle. */
  ledgerEntryId: string;
}

export interface SolanaPaymentVerification {
  verified: boolean;
  signature: string;
  recipient: string;
  lamports: number;
  slot: number;
  explorerUrl: string;
  reason?: string;
}

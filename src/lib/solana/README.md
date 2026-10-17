# Solana settlement boundary

This directory is the seam for the Solana "Pay with Solana" settlement
feature on the Money Owed/Lent ledger. The rest of the app only ever
imports `settleLedgerWithSolana()` (the server action) and `SolanaProvider`
(wraps `src/app/(app)/layout.tsx`) — never a Solana package directly from a
page or another lib. That keeps this feature isolated from the Auth0 and
Tiger Data seams the same way those two are isolated from each other.

## Current state (working devnet demo)

- `config.ts` — network/RPC endpoint, the fixed demo settlement address
  (`SOLANA_DEMO_RECIPIENT`), and the demo USD-to-SOL rate. There is no live
  price feed, so the rate is explicit and labeled in the UI as demo-only.
- `provider.tsx` — `SolanaProvider`, a client component wrapping
  `@solana/wallet-adapter-react`'s connection/wallet providers, configured
  for devnet with individually imported Phantom and Solflare adapters. The catch-all wallet bundle is removed.
- `verify.ts` — `verifySolanaTransfer()`, server-only. Re-derives the
  transfer (recipient, lamports, confirmation) from the chain by signature;
  never trusts amounts the client reports.
- `actions.ts` — `settleLedgerWithSolana()`, a Server Action called directly
  from `PayWithSolanaDialog` (not via a `<form>`). Verifies on-chain, then
  calls `settleLedgerAmount()` in `src/lib/finance/ledger.ts` — the same
  settlement path the manual "Log payment" button uses — so a Solana
  settlement updates the ledger/forecast exactly like any other repayment.
- `src/components/ledger/pay-with-solana-dialog.tsx` — the UI: connect
  wallet, review the demo SOL amount, send a devnet `SystemProgram.transfer`,
  then show the verified result with a Solana Explorer link.

## Why one fixed recipient address

CashCompass has no per-user wallet linking yet — Auth0 identifies the
CashCompass user, a connected wallet identifies who's authorizing a
payment, and the two are deliberately separate systems (see
`src/lib/auth/README.md`). Associating a wallet with a specific
counterparty is the natural next step for whoever extends this seam; until
then every devnet settlement in the demo goes to one address so there's a
real, verifiable transaction to show on Explorer.

Set `SOLANA_DEMO_RECIPIENT_ADDRESS` in `.env.local` to a devnet wallet you
control if you want the balance/history to be yours rather than the
generated default in `config.ts`.

## Extending the seam

- Per-counterparty wallets: add a `counterpartyWallet` lookup (keyed by the
  ledger entry's counterparty) and pass the resolved address into
  `PayWithSolanaDialog` instead of the fixed `SOLANA_DEMO_RECIPIENT`.
- Real USD/SOL pricing: replace `SOLANA_DEMO_USD_PER_SOL` with a live quote
  and make sure the UI's "demo rate" disclosure is removed or updated to
  reflect that it's now real — never leave stale "demo" language next to a
  real conversion.
- Mainnet: swap `SOLANA_RPC_ENDPOINT`'s default and `SOLANA_NETWORK`, and
  re-check `explorerUrl()`'s `cluster` query param.

Nothing outside this directory and `pay-with-solana-dialog.tsx` should need
to change for any of the above.

## Verification and receipts

Settlement checks a session-owned, outstanding payable ledger entry before network access. On-chain verification requires a confirmed/finalized, successful transaction and a matching system transfer for the expected amount and recipient. A transaction signature can be claimed only once across users. `receipts.ts` uses a database primary key when `DATABASE_URL` is set and process memory otherwise. Run the updated `db/schema.sql` before using database settlement.

Mocked tests cover confirmation, failed transactions, amount/recipient mismatch, multi-transfer transactions, and duplicate claims. No wallet authorization or live devnet broadcast was performed during local verification. Receipt claims and ledger mutations are separate operations; production needs atomic settlement/reconciliation for process crashes. This remains an explicit devnet demo with a fixed rate and recipient.

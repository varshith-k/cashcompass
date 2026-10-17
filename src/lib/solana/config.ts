export const SOLANA_NETWORK = "devnet" as const;

export const SOLANA_RPC_ENDPOINT =
  process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";

/**
 * Where a "Pay with Solana" transfer lands. CashCompass has no per-user
 * wallet linking yet (that's for the Solana integration to extend — see
 * README.md), so every devnet settlement in this demo goes to one fixed
 * address. Set SOLANA_DEMO_RECIPIENT_ADDRESS to a real devnet wallet you
 * control so the balance and Explorer history are visibly real.
 */
export const SOLANA_DEMO_RECIPIENT =
  process.env.SOLANA_DEMO_RECIPIENT_ADDRESS ||
  "CSScTCPyQ5MCbXKfT6kdaWaUhksCky8YNd9MA53AJ9JV";

/**
 * Demo-only USD-to-SOL rate. No live price feed is wired in, so this must
 * never be presented as a real quote — the UI labels it explicitly as a
 * demo rate, per the project's "don't invent financial data" rule.
 */
export const SOLANA_DEMO_USD_PER_SOL = 20;

export function usdToLamports(usd: number) {
  return Math.round((usd / SOLANA_DEMO_USD_PER_SOL) * 1_000_000_000);
}

export function explorerUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

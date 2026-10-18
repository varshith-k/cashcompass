// Pure bill-splitting maths (no I/O). Everything is done in whole cents so
// shares always add up to the bill exactly.

export const ME = "me";

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Splits evenly; leftover cents go one each to the first people, so the sum is exact. */
export function equalShares(total: number, people: number): number[] {
  if (people <= 0) return [];
  const cents = toCents(total);
  const base = Math.floor(cents / people);
  const remainder = cents - base * people;
  return Array.from({ length: people }, (_, i) => fromCents(base + (i < remainder ? 1 : 0)));
}

/** How far the shares are from the total, in cents (0 means they add up exactly). */
export function shareDifferenceCents(total: number, shares: number[]): number {
  return toCents(total) - shares.reduce((sum, share) => sum + toCents(share), 0);
}

export function validateShares(total: number, shares: number[]): string | null {
  if (!Number.isFinite(total) || total <= 0) return "Enter the bill total.";
  if (shares.length === 0) return "Choose who's splitting.";
  if (shares.some((share) => !Number.isFinite(share) || share < 0)) return "Shares can't be negative.";
  const diff = shareDifferenceCents(total, shares);
  if (diff !== 0) {
    const amount = fromCents(Math.abs(diff)).toFixed(2);
    return diff > 0 ? `$${amount} of the bill isn't assigned to anyone yet.` : `Shares are $${amount} more than the bill.`;
  }
  return null;
}

/**
 * Takes AI-proposed amounts and makes them add up exactly: small rounding
 * gaps (≤ 2% of the bill) are spread by cents across the people with the
 * largest shares. Larger gaps are left for the user to fix and reported.
 */
export function reconcileShares(total: number, shares: number[]): { shares: number[]; adjusted: boolean; warning?: string } {
  const cents = shares.map((share) => Math.max(0, toCents(share)));
  let diff = toCents(total) - cents.reduce((a, b) => a + b, 0);
  if (diff === 0) return { shares: cents.map(fromCents), adjusted: false };
  if (Math.abs(diff) > Math.max(2, Math.round(toCents(total) * 0.02)) || cents.every((c) => c === 0)) {
    return { shares: cents.map(fromCents), adjusted: false, warning: "The suggested amounts don't add up to the bill. Please adjust them." };
  }
  const order = cents.map((c, i) => [c, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  let k = 0;
  while (diff !== 0) {
    const i = order[k % order.length]!;
    if (diff > 0) {
      cents[i]! += 1;
      diff -= 1;
    } else if (cents[i]! > 0) {
      cents[i]! -= 1;
      diff += 1;
    }
    k++;
  }
  return { shares: cents.map(fromCents), adjusted: true };
}

export type EventDirection = "income" | "expense";
export type EventCertainty = "certain" | "uncertain";
export type EventRecord = "actual" | "planned";
export type EventSource = "manual" | "nessie";
export type EventRecurrence = "one-time" | "recurring";

/**
 * Shared financial-event model. Transactions, bills, income, repayments,
 * savings contributions, and what-if scenario events all normalize into
 * this shape so a single forecast calculation can consume any of them.
 */
export interface FinancialEvent {
  id: string;
  date: string; // ISO date
  amount: number; // positive magnitude; direction carries the sign
  direction: EventDirection;
  record: EventRecord;
  certainty: EventCertainty;
  recurrence: EventRecurrence;
  source: EventSource;
  /** Stable external key for idempotent Nessie synchronization. */
  sourceRecordId?: string;
  category: string;
  counterparty: string;
  /** Baseline events feed the real forecast; a what-if event is reversible and scoped to a simulation only. */
  scenarioId?: string;
  /** Ledger entries only — lets "remind to pay" use a real WhatsApp link instead of a fabricated one. */
  counterpartyPhone?: string;
}

export type NewFinancialEvent = Omit<FinancialEvent, "id">;
export type FinancialEventUpdate = Partial<NewFinancialEvent>;

export interface SafeToSpendInput {
  availableBalance: number;
  upcomingBills: number;
  savingsEarmarks: number;
  preferredBuffer: number;
}

export interface SafeToSpendResult {
  safeToSpend: number;
  breakdown: SafeToSpendInput;
}

export interface ForecastPoint {
  date: string;
  projectedBalance: number;
  /** Balance if uncertain incoming repayments never arrive. */
  conservativeBalance: number;
  isLowBalanceRisk: boolean;
}

import "server-only";
import type { FinancialEvent, FinancialEventUpdate, NewFinancialEvent } from "./types";
import { DemoFinancialEventRepository } from "./demo-repository";
import { TigerDataFinancialEventRepository } from "./tiger-repository";

/**
 * Everything that reads or writes financial events goes through this
 * interface — never through demo-data.ts or a database client directly.
 * That's the seam where Tiger Data (TimescaleDB on Postgres) plugs in:
 * see src/lib/finance/README.md.
 */
export interface FinancialEventRepository {
  listEvents(): Promise<FinancialEvent[]>;
  createEvent(input: NewFinancialEvent): Promise<FinancialEvent>;
  updateEvent(id: string, patch: FinancialEventUpdate): Promise<FinancialEvent>;
  deleteEvent(id: string): Promise<void>;
}

let cached: FinancialEventRepository | null = null;

export function getFinancialEventRepository(): FinancialEventRepository {
  if (!cached) {
    cached = process.env.DATABASE_URL
      ? new TigerDataFinancialEventRepository()
      : new DemoFinancialEventRepository();
  }
  return cached;
}

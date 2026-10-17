import "server-only";
import { Pool, type PoolClient } from "pg";
import type { FinancialEventRepository } from "./repository";
import type { FinancialEvent } from "./types";

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

interface FinancialEventRow {
  id: string;
  event_date: Date;
  amount: string;
  direction: FinancialEvent["direction"];
  record: FinancialEvent["record"];
  certainty: FinancialEvent["certainty"];
  recurrence: FinancialEvent["recurrence"];
  source: FinancialEvent["source"];
  category: string;
  counterparty: string;
  scenario_id: string | null;
}

function toFinancialEvent(row: FinancialEventRow): FinancialEvent {
  return {
    id: row.id,
    date: row.event_date.toISOString(),
    amount: Number(row.amount),
    direction: row.direction,
    record: row.record,
    certainty: row.certainty,
    recurrence: row.recurrence,
    source: row.source,
    category: row.category,
    counterparty: row.counterparty,
    scenarioId: row.scenario_id ?? undefined,
  };
}

/**
 * Tiger Data (TimescaleDB on Postgres) implementation. Query against the
 * `financial_events` hypertable defined in db/schema.sql — run that
 * migration against your Tiger Data service before setting DATABASE_URL,
 * and this repository works with no other code changes.
 */
export class TigerDataFinancialEventRepository implements FinancialEventRepository {
  private async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  async listEvents(): Promise<FinancialEvent[]> {
    return this.withClient(async (client) => {
      const result = await client.query<FinancialEventRow>(
        `SELECT id, event_date, amount, direction, record, certainty,
                recurrence, source, category, counterparty, scenario_id
         FROM financial_events
         ORDER BY event_date`,
      );
      return result.rows.map(toFinancialEvent);
    });
  }
}

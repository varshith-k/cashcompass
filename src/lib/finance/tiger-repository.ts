import "server-only";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { FinancialEventRepository } from "./repository";
import type { FinancialEvent, FinancialEventUpdate, NewFinancialEvent } from "./types";

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

  async createEvent(input: NewFinancialEvent): Promise<FinancialEvent> {
    return this.withClient(async (client) => {
      const result = await client.query<FinancialEventRow>(
        `INSERT INTO financial_events
           (id, event_date, amount, direction, record, certainty,
            recurrence, source, category, counterparty, scenario_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          randomUUID(),
          input.date,
          input.amount,
          input.direction,
          input.record,
          input.certainty,
          input.recurrence,
          input.source,
          input.category,
          input.counterparty,
          input.scenarioId ?? null,
        ],
      );
      return toFinancialEvent(result.rows[0]);
    });
  }

  async updateEvent(id: string, patch: FinancialEventUpdate): Promise<FinancialEvent> {
    return this.withClient(async (client) => {
      const columns: Record<keyof FinancialEventUpdate, string> = {
        date: "event_date",
        amount: "amount",
        direction: "direction",
        record: "record",
        certainty: "certainty",
        recurrence: "recurrence",
        source: "source",
        category: "category",
        counterparty: "counterparty",
        scenarioId: "scenario_id",
      };

      const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as [
        keyof FinancialEventUpdate,
        unknown,
      ][];

      if (entries.length === 0) {
        const existing = await client.query<FinancialEventRow>(
          "SELECT * FROM financial_events WHERE id = $1",
          [id],
        );
        if (!existing.rows[0]) throw new Error(`Financial event ${id} not found`);
        return toFinancialEvent(existing.rows[0]);
      }

      const setClause = entries.map(([key], index) => `${columns[key]} = $${index + 2}`).join(", ");
      const values = entries.map(([, value]) => value);

      const result = await client.query<FinancialEventRow>(
        `UPDATE financial_events SET ${setClause} WHERE id = $1 RETURNING *`,
        [id, ...values],
      );

      if (!result.rows[0]) {
        throw new Error(`Financial event ${id} not found`);
      }
      return toFinancialEvent(result.rows[0]);
    });
  }

  async deleteEvent(id: string): Promise<void> {
    await this.withClient((client) => client.query("DELETE FROM financial_events WHERE id = $1", [id]));
  }
}

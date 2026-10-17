import "server-only";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { FinancialEventStore } from "./repository";
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
 *
 * Every query is filtered by owner_id (the Auth0 `sub`, supplied by
 * repository.ts from the verified session), so a user can only ever touch
 * their own rows — an update or delete with someone else's id matches nothing.
 */
export class TigerDataFinancialEventStore implements FinancialEventStore {
  private async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  async listEvents(ownerId: string): Promise<FinancialEvent[]> {
    return this.withClient(async (client) => {
      const result = await client.query<FinancialEventRow>(
        `SELECT id, event_date, amount, direction, record, certainty,
                recurrence, source, category, counterparty, scenario_id
         FROM financial_events
         WHERE owner_id = $1
         ORDER BY event_date`,
        [ownerId],
      );
      return result.rows.map(toFinancialEvent);
    });
  }

  async createEvent(ownerId: string, input: NewFinancialEvent): Promise<FinancialEvent> {
    return this.withClient(async (client) => {
      const result = await client.query<FinancialEventRow>(
        `INSERT INTO financial_events
           (id, owner_id, event_date, amount, direction, record, certainty,
            recurrence, source, category, counterparty, scenario_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          randomUUID(),
          ownerId,
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

  async updateEvent(ownerId: string, id: string, patch: FinancialEventUpdate): Promise<FinancialEvent> {
    return this.withClient(async (client) => {
      // Deliberately partial: counterpartyPhone is ledger/WhatsApp-reminder
      // UI convenience, not time-series analytics data, so it isn't part
      // of the hypertable schema. A patch containing it just drops that
      // one field for this backend rather than erroring.
      const columns: Partial<Record<keyof FinancialEventUpdate, string>> = {
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

      const entries = Object.entries(patch).filter(
        ([key, value]) => value !== undefined && key in columns,
      ) as [keyof FinancialEventUpdate, unknown][];

      if (entries.length === 0) {
        const existing = await client.query<FinancialEventRow>(
          "SELECT * FROM financial_events WHERE id = $1 AND owner_id = $2",
          [id, ownerId],
        );
        if (!existing.rows[0]) throw new Error(`Financial event ${id} not found`);
        return toFinancialEvent(existing.rows[0]);
      }

      const setClause = entries.map(([key], index) => `${columns[key]} = $${index + 3}`).join(", ");
      const values = entries.map(([, value]) => value);

      const result = await client.query<FinancialEventRow>(
        `UPDATE financial_events SET ${setClause} WHERE id = $1 AND owner_id = $2 RETURNING *`,
        [id, ownerId, ...values],
      );

      if (!result.rows[0]) {
        throw new Error(`Financial event ${id} not found`);
      }
      return toFinancialEvent(result.rows[0]);
    });
  }

  async deleteEvent(ownerId: string, id: string): Promise<void> {
    await this.withClient((client) =>
      client.query("DELETE FROM financial_events WHERE id = $1 AND owner_id = $2", [id, ownerId]),
    );
  }
}

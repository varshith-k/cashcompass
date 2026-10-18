import "server-only";
import { randomUUID } from "node:crypto";
import { getTigerPool } from "./tiger-repository";

export interface BillReminder {
  id: string;
  ownerId: string;
  billId: string;
  /** The signed-in user's own email, captured when they turned the reminder on. */
  email: string;
  daysBefore: number;
  hour: number;
  timeZone: string;
  /** `${billId}:${dueDate}` of the last occurrence a reminder was sent for. */
  lastSentKey?: string;
}

export type ReminderSettings = Pick<BillReminder, "email" | "daysBefore" | "hour" | "timeZone">;

interface ReminderStore {
  listForOwner(ownerId: string): Promise<BillReminder[]>;
  listAll(): Promise<BillReminder[]>;
  upsert(ownerId: string, billId: string, settings: ReminderSettings): Promise<BillReminder>;
  remove(ownerId: string, billId: string): Promise<void>;
  move(ownerId: string, fromBillId: string, toBillId: string): Promise<void>;
  markSent(id: string, key: string): Promise<void>;
}

/** In-memory (no DATABASE_URL). On globalThis: the reminder job route and pages are bundled separately. */
class MemoryReminderStore implements ReminderStore {
  private get items() {
    const g = globalThis as typeof globalThis & { __cashcompassBillReminders?: BillReminder[] };
    return (g.__cashcompassBillReminders ??= []);
  }
  async listForOwner(ownerId: string) {
    return this.items.filter((r) => r.ownerId === ownerId).map((r) => ({ ...r }));
  }
  async listAll() {
    return this.items.map((r) => ({ ...r }));
  }
  async upsert(ownerId: string, billId: string, settings: ReminderSettings) {
    const existing = this.items.find((r) => r.ownerId === ownerId && r.billId === billId);
    if (existing) {
      Object.assign(existing, settings);
      return { ...existing };
    }
    const reminder: BillReminder = { id: randomUUID(), ownerId, billId, ...settings };
    this.items.push(reminder);
    return { ...reminder };
  }
  async remove(ownerId: string, billId: string) {
    const index = this.items.findIndex((r) => r.ownerId === ownerId && r.billId === billId);
    if (index !== -1) this.items.splice(index, 1);
  }
  async move(ownerId: string, fromBillId: string, toBillId: string) {
    const reminder = this.items.find((r) => r.ownerId === ownerId && r.billId === fromBillId);
    if (reminder) reminder.billId = toBillId;
  }
  async markSent(id: string, key: string) {
    const reminder = this.items.find((r) => r.id === id);
    if (reminder) reminder.lastSentKey = key;
  }
}

interface ReminderRow {
  id: string;
  owner_id: string;
  bill_id: string;
  email: string;
  days_before: number;
  hour: number;
  time_zone: string;
  last_sent_key: string | null;
}

const toReminder = (row: ReminderRow): BillReminder => ({
  id: row.id,
  ownerId: row.owner_id,
  billId: row.bill_id,
  email: row.email,
  daysBefore: row.days_before,
  hour: row.hour,
  timeZone: row.time_zone,
  lastSentKey: row.last_sent_key ?? undefined,
});

/** Tiger Data table `bill_reminders` (db/schema.sql). Every user-facing query is scoped by owner_id. */
class TigerReminderStore implements ReminderStore {
  private async query<T extends object>(sql: string, values: unknown[]): Promise<T[]> {
    return (await getTigerPool().query<T>(sql, values)).rows;
  }
  async listForOwner(ownerId: string) {
    return (await this.query<ReminderRow>("SELECT * FROM bill_reminders WHERE owner_id = $1", [ownerId])).map(toReminder);
  }
  async listAll() {
    return (await this.query<ReminderRow>("SELECT * FROM bill_reminders", [])).map(toReminder);
  }
  async upsert(ownerId: string, billId: string, settings: ReminderSettings) {
    const rows = await this.query<ReminderRow>(
      `INSERT INTO bill_reminders (id, owner_id, bill_id, email, days_before, hour, time_zone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (owner_id, bill_id) DO UPDATE
         SET email = EXCLUDED.email, days_before = EXCLUDED.days_before, hour = EXCLUDED.hour, time_zone = EXCLUDED.time_zone
       RETURNING *`,
      [randomUUID(), ownerId, billId, settings.email, settings.daysBefore, settings.hour, settings.timeZone],
    );
    return toReminder(rows[0]!);
  }
  async remove(ownerId: string, billId: string) {
    await this.query("DELETE FROM bill_reminders WHERE owner_id = $1 AND bill_id = $2", [ownerId, billId]);
  }
  async move(ownerId: string, fromBillId: string, toBillId: string) {
    await this.query("UPDATE bill_reminders SET bill_id = $3 WHERE owner_id = $1 AND bill_id = $2", [ownerId, fromBillId, toBillId]);
  }
  async markSent(id: string, key: string) {
    await this.query("UPDATE bill_reminders SET last_sent_key = $2 WHERE id = $1", [id, key]);
  }
}

let store: ReminderStore | null = null;

export function getReminderStore(): ReminderStore {
  if (!store) store = process.env.DATABASE_URL ? new TigerReminderStore() : new MemoryReminderStore();
  return store;
}

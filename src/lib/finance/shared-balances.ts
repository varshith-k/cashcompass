import "server-only";
import { randomUUID } from "node:crypto";
import { ensureAppTables } from "./app-tables";
import { getTigerPool } from "./tiger-repository";
import type { FinancialEvent } from "./types";

/**
 * A Settle Up balance shared with another CashCompass user. The sender's
 * balance stays in their own ledger; the recipient sees it in Settle Up only
 * when signed in with that (verified) email, and nothing reaches their ledger
 * until they accept. After that, a payment logged on either side is mirrored
 * to the other.
 */
export interface SharedBalance {
  id: string;
  fromOwnerId: string;
  fromName: string;
  fromEmail?: string;
  toEmail: string;
  /** From the sender's point of view: the recipient owes the sender, or the sender owes the recipient. */
  kind: "they_owe_sender" | "sender_owes";
  amount: number;
  description: string;
  dueDate: string;
  fromEventId: string;
  status: SharedStatus;
  toOwnerId?: string;
  toEventId?: string;
}

export type SharedStatus = "pending" | "accepted" | "declined" | "settled" | "cancelled";
export type NewSharedBalance = Omit<SharedBalance, "id" | "status" | "toOwnerId" | "toEventId">;
type SharedPatch = Partial<Pick<SharedBalance, "status" | "toOwnerId" | "toEventId">>;

interface SharedBalanceStore {
  create(input: NewSharedBalance): Promise<SharedBalance | null>;
  get(id: string): Promise<SharedBalance | null>;
  listPendingFor(email: string): Promise<SharedBalance[]>;
  listSentBy(ownerId: string): Promise<SharedBalance[]>;
  /** The share an event belongs to, on either side. */
  findByEvent(ownerId: string, eventId: string): Promise<SharedBalance | null>;
  update(id: string, patch: SharedPatch, onlyIfStatus?: SharedStatus): Promise<boolean>;
}

class MemorySharedBalanceStore implements SharedBalanceStore {
  private get items() {
    const g = globalThis as typeof globalThis & { __cashcompassSharedBalances?: SharedBalance[] };
    return (g.__cashcompassSharedBalances ??= []);
  }
  async create(input: NewSharedBalance) {
    if (this.items.some((s) => s.fromOwnerId === input.fromOwnerId && s.fromEventId === input.fromEventId)) return null;
    const share: SharedBalance = { ...input, id: randomUUID(), status: "pending" };
    this.items.push(share);
    return { ...share };
  }
  async get(id: string) {
    const share = this.items.find((s) => s.id === id);
    return share ? { ...share } : null;
  }
  async listPendingFor(email: string) {
    return this.items.filter((s) => s.toEmail === email && s.status === "pending").map((s) => ({ ...s }));
  }
  async listSentBy(ownerId: string) {
    return this.items.filter((s) => s.fromOwnerId === ownerId).map((s) => ({ ...s }));
  }
  async findByEvent(ownerId: string, eventId: string) {
    const share = this.items.find((s) => (s.fromOwnerId === ownerId && s.fromEventId === eventId) || (s.toOwnerId === ownerId && s.toEventId === eventId));
    return share ? { ...share } : null;
  }
  async update(id: string, patch: SharedPatch, onlyIfStatus?: SharedStatus) {
    const share = this.items.find((s) => s.id === id);
    if (!share || (onlyIfStatus && share.status !== onlyIfStatus)) return false;
    Object.assign(share, patch);
    return true;
  }
}

interface SharedRow {
  id: string;
  from_owner_id: string;
  from_name: string;
  from_email: string | null;
  to_email: string;
  kind: SharedBalance["kind"];
  amount: string;
  description: string;
  due_date: Date;
  from_event_id: string;
  status: SharedStatus;
  to_owner_id: string | null;
  to_event_id: string | null;
}

const toShare = (row: SharedRow): SharedBalance => ({
  id: row.id,
  fromOwnerId: row.from_owner_id,
  fromName: row.from_name,
  ...(row.from_email ? { fromEmail: row.from_email } : {}),
  toEmail: row.to_email,
  kind: row.kind,
  amount: Number(row.amount),
  description: row.description,
  dueDate: new Date(row.due_date).toISOString(),
  fromEventId: row.from_event_id,
  status: row.status,
  ...(row.to_owner_id ? { toOwnerId: row.to_owner_id } : {}),
  ...(row.to_event_id ? { toEventId: row.to_event_id } : {}),
});

/** Tiger Data table `shared_balances` (db/schema.sql). */
class TigerSharedBalanceStore implements SharedBalanceStore {
  private async query<T extends object>(sql: string, values: unknown[]): Promise<T[]> {
    const pool = getTigerPool();
    await ensureAppTables(pool);
    return (await pool.query<T>(sql, values)).rows;
  }
  async create(input: NewSharedBalance) {
    const rows = await this.query<SharedRow>(
      `INSERT INTO shared_balances (id, from_owner_id, from_name, from_email, to_email, kind, amount, description, due_date, from_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (from_owner_id, from_event_id) DO NOTHING
       RETURNING *`,
      [randomUUID(), input.fromOwnerId, input.fromName, input.fromEmail ?? null, input.toEmail, input.kind, input.amount, input.description, input.dueDate, input.fromEventId],
    );
    return rows[0] ? toShare(rows[0]) : null;
  }
  async get(id: string) {
    const rows = await this.query<SharedRow>("SELECT * FROM shared_balances WHERE id = $1", [id]);
    return rows[0] ? toShare(rows[0]) : null;
  }
  async listPendingFor(email: string) {
    return (await this.query<SharedRow>("SELECT * FROM shared_balances WHERE to_email = $1 AND status = 'pending' ORDER BY created_at DESC", [email])).map(toShare);
  }
  async listSentBy(ownerId: string) {
    return (await this.query<SharedRow>("SELECT * FROM shared_balances WHERE from_owner_id = $1", [ownerId])).map(toShare);
  }
  async findByEvent(ownerId: string, eventId: string) {
    const rows = await this.query<SharedRow>(
      "SELECT * FROM shared_balances WHERE (from_owner_id = $1 AND from_event_id = $2) OR (to_owner_id = $1 AND to_event_id = $2) LIMIT 1",
      [ownerId, eventId],
    );
    return rows[0] ? toShare(rows[0]) : null;
  }
  async update(id: string, patch: SharedPatch, onlyIfStatus?: SharedStatus) {
    const rows = await this.query<{ id: string }>(
      `UPDATE shared_balances
         SET status = COALESCE($2, status), to_owner_id = COALESCE($3, to_owner_id), to_event_id = COALESCE($4, to_event_id), updated_at = now()
       WHERE id = $1 AND ($5::text IS NULL OR status = $5)
       RETURNING id`,
      [id, patch.status ?? null, patch.toOwnerId ?? null, patch.toEventId ?? null, onlyIfStatus ?? null],
    );
    return rows.length > 0;
  }
}

let store: SharedBalanceStore | null = null;

export function getSharedBalanceStore(): SharedBalanceStore {
  if (!store) store = process.env.DATABASE_URL ? new TigerSharedBalanceStore() : new MemorySharedBalanceStore();
  return store;
}

/**
 * Offers a balance the signed-in user just recorded to the other person, if
 * they have an email. Best-effort: sharing never blocks saving the balance.
 */
export async function shareBalance(
  sender: { id: string; name: string; email: string },
  toEmail: string | undefined,
  event: FinancialEvent,
  description: string,
): Promise<void> {
  const email = toEmail?.trim().toLowerCase();
  if (!email || email === (sender.email ?? "").toLowerCase()) return;
  try {
    await getSharedBalanceStore().create({
      fromOwnerId: sender.id,
      fromName: sender.name,
      ...(sender.email ? { fromEmail: sender.email.toLowerCase() } : {}),
      toEmail: email,
      kind: event.direction === "income" ? "they_owe_sender" : "sender_owes",
      amount: event.amount,
      description: description.slice(0, 200),
      dueDate: event.date,
      fromEventId: event.id,
    });
  } catch (error) {
    console.warn("[shared] couldn't share balance:", error instanceof Error ? error.message : "unknown error");
  }
}

/** When either side deletes their copy, the share is withdrawn (sender) or declined (recipient). */
export async function unshareEvent(ownerId: string, eventId: string): Promise<void> {
  try {
    const shares = getSharedBalanceStore();
    const share = await shares.findByEvent(ownerId, eventId);
    if (!share || share.status === "settled") return;
    await shares.update(share.id, { status: share.fromOwnerId === ownerId ? "cancelled" : "declined" });
  } catch (error) {
    console.warn("[shared] couldn't update share after delete:", error instanceof Error ? error.message : "unknown error");
  }
}

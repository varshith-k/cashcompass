import "server-only";
import { assertStorageConfigured, withOwnerTransaction } from "@/lib/storage/transaction";
import { requireOwnerId } from "@/lib/auth/session";
import type { FinancialEvent, FinancialEventUpdate, NewFinancialEvent } from "./types";
import { DemoFinancialEventStore } from "./demo-repository";
import { TigerDataFinancialEventStore } from "./tiger-repository";

/**
 * Everything that reads or writes financial events goes through this
 * interface — never through demo-data.ts or a database client directly.
 * That's the seam where Tiger Data (TimescaleDB on Postgres) plugs in:
 * see src/lib/finance/README.md.
 *
 * Every call is scoped to the signed-in user: the owner comes from the
 * verified server session (src/lib/auth/session.ts), never from the caller,
 * so one user can't read, edit or delete another user's events even by
 * guessing an id. Signed-out calls redirect to login.
 */
export interface FinancialEventRepository {
  listEvents(): Promise<FinancialEvent[]>;
  createEvent(input: NewFinancialEvent): Promise<FinancialEvent>;
  updateEvent(id: string, patch: FinancialEventUpdate): Promise<FinancialEvent>;
  deleteEvent(id: string): Promise<void>;
}

/** Storage backend. Every method takes the owner explicitly; only this module calls it. */
export interface FinancialEventStore {
  listEvents(ownerId: string): Promise<FinancialEvent[]>;
  createEvent(ownerId: string, input: NewFinancialEvent): Promise<FinancialEvent>;
  updateEvent(ownerId: string, id: string, patch: FinancialEventUpdate): Promise<FinancialEvent>;
  deleteEvent(ownerId: string, id: string): Promise<void>;
}

let cachedStore: FinancialEventStore | null = null;

function getStore(): FinancialEventStore {
  assertStorageConfigured();
  if (!cachedStore) {
    cachedStore = process.env.DATABASE_URL
      ? new TigerDataFinancialEventStore()
      : new DemoFinancialEventStore();
  }
  return cachedStore;
}

const userScopedRepository: FinancialEventRepository = {
  async listEvents() {
    return getStore().listEvents(await requireOwnerId());
  },
  async createEvent(input) {
    const ownerId = await requireOwnerId();
    return withOwnerTransaction(ownerId, () => getStore().createEvent(ownerId, input));
  },
  async updateEvent(id, patch) {
    const ownerId = await requireOwnerId();
    return withOwnerTransaction(ownerId, () => getStore().updateEvent(ownerId, id, patch));
  },
  async deleteEvent(id) {
    const ownerId = await requireOwnerId();
    return withOwnerTransaction(ownerId, () => getStore().deleteEvent(ownerId, id));
  },
};

export function getFinancialEventRepository(): FinancialEventRepository {
  return userScopedRepository;
}

/** Authenticated unit of work; nested repository/planning writes share its transaction. */
export async function withFinancialTransaction<T>(work: (ownerId: string) => Promise<T>): Promise<T> {
  const ownerId = await requireOwnerId();
  return withOwnerTransaction(ownerId, () => work(ownerId));
}

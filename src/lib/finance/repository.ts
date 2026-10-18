import "server-only";
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
  /**
   * Actual (not planned) expense total per category, for the current UTC
   * calendar month. In Tiger Data mode this reads the pre-computed
   * `monthly_category_spend` continuous aggregate directly instead of
   * scanning every event — the point of having it. Demo mode has no
   * aggregate to read, so it derives the same shape from in-memory events.
   */
  getMonthlyCategorySpend(): Promise<Map<string, number>>;
}

/** Storage backend. Every method takes the owner explicitly; only this module calls it. */
export interface FinancialEventStore {
  listEvents(ownerId: string): Promise<FinancialEvent[]>;
  createEvent(ownerId: string, input: NewFinancialEvent): Promise<FinancialEvent>;
  updateEvent(ownerId: string, id: string, patch: FinancialEventUpdate): Promise<FinancialEvent>;
  deleteEvent(ownerId: string, id: string): Promise<void>;
  getMonthlyCategorySpend(ownerId: string): Promise<Map<string, number>>;
}

let cachedStore: FinancialEventStore | null = null;

function getStore(): FinancialEventStore {
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
    return getStore().createEvent(await requireOwnerId(), input);
  },
  async updateEvent(id, patch) {
    return getStore().updateEvent(await requireOwnerId(), id, patch);
  },
  async deleteEvent(id) {
    return getStore().deleteEvent(await requireOwnerId(), id);
  },
  async getMonthlyCategorySpend() {
    return getStore().getMonthlyCategorySpend(await requireOwnerId());
  },
};

export function getFinancialEventRepository(): FinancialEventRepository {
  return userScopedRepository;
}

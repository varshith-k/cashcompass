import "server-only";
import type { FinancialEventRepository } from "./repository";
import type { FinancialEvent, FinancialEventUpdate, NewFinancialEvent } from "./types";
import { getDemoEvents } from "./demo-data";

/**
 * Used until DATABASE_URL points at a real Tiger Data instance. Backed by
 * a module-level array, so writes persist for the life of the server
 * process (long enough for a demo session) but reset on restart — there's
 * no durable storage until Tiger Data is wired up.
 */
let store: FinancialEvent[] | null = null;

function ensureStore() {
  if (!store) {
    store = getDemoEvents();
  }
  return store;
}

export class DemoFinancialEventRepository implements FinancialEventRepository {
  async listEvents() {
    return ensureStore();
  }

  async createEvent(input: NewFinancialEvent) {
    const event: FinancialEvent = { ...input, id: crypto.randomUUID() };
    ensureStore().push(event);
    return event;
  }

  async updateEvent(id: string, patch: FinancialEventUpdate) {
    const events = ensureStore();
    const index = events.findIndex((event) => event.id === id);
    if (index === -1) {
      throw new Error(`Financial event ${id} not found`);
    }
    events[index] = { ...events[index], ...patch };
    return events[index];
  }

  async deleteEvent(id: string) {
    const events = ensureStore();
    const index = events.findIndex((event) => event.id === id);
    if (index !== -1) {
      events.splice(index, 1);
    }
  }
}

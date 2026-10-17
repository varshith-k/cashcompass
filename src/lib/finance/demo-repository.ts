import "server-only";
import type { FinancialEventStore } from "./repository";
import type { FinancialEvent, FinancialEventUpdate, NewFinancialEvent } from "./types";
import { getDemoEvents } from "./demo-data";

/**
 * Used until DATABASE_URL points at a real Tiger Data instance. Backed by
 * module-level memory, so writes persist for the life of the server
 * process (long enough for a demo session) but reset on restart — there's
 * no durable storage until Tiger Data is wired up.
 *
 * Each user gets their own copy of the demo events on first access, so
 * one person's edits never show up for anyone else.
 */
const stores = new Map<string, FinancialEvent[]>();

function storeFor(ownerId: string) {
  let events = stores.get(ownerId);
  if (!events) {
    events = getDemoEvents();
    stores.set(ownerId, events);
  }
  return events;
}

export class DemoFinancialEventStore implements FinancialEventStore {
  async listEvents(ownerId: string) {
    return storeFor(ownerId);
  }

  async createEvent(ownerId: string, input: NewFinancialEvent) {
    const event: FinancialEvent = { ...input, id: crypto.randomUUID() };
    storeFor(ownerId).push(event);
    return event;
  }

  async updateEvent(ownerId: string, id: string, patch: FinancialEventUpdate) {
    const events = storeFor(ownerId);
    const index = events.findIndex((event) => event.id === id);
    if (index === -1) {
      throw new Error(`Financial event ${id} not found`);
    }
    events[index] = { ...events[index], ...patch };
    return events[index];
  }

  async deleteEvent(ownerId: string, id: string) {
    const events = storeFor(ownerId);
    const index = events.findIndex((event) => event.id === id);
    if (index !== -1) {
      events.splice(index, 1);
    }
  }
}

import "server-only";
import type { FinancialEventStore } from "./repository";
import type { FinancialEvent, FinancialEventUpdate, NewFinancialEvent } from "./types";
import { getDemoEvents } from "./demo-data";

import { readMemory, withOwnerTransaction } from "@/lib/storage/transaction";

function storeFor(ownerId: string) {
  return readMemory("events", ownerId, getDemoEvents);
}

export class DemoFinancialEventStore implements FinancialEventStore {
  async listEvents(ownerId: string) {
    return storeFor(ownerId).map((event) => ({ ...event }));
  }

  async createEvent(ownerId: string, input: NewFinancialEvent) {
    return withOwnerTransaction(ownerId, async () => {
    const event: FinancialEvent = { ...input, id: crypto.randomUUID() };
    storeFor(ownerId).push(event);
    return event;
    });
  }

  async updateEvent(ownerId: string, id: string, patch: FinancialEventUpdate) {
    return withOwnerTransaction(ownerId, async () => {
    const events = storeFor(ownerId);
    const index = events.findIndex((event) => event.id === id);
    if (index === -1) {
      throw new Error(`Financial event ${id} not found`);
    }
    events[index] = { ...events[index], ...patch };
    return events[index];
    });
  }

  async deleteEvent(ownerId: string, id: string) {
    return withOwnerTransaction(ownerId, async () => {
    const events = storeFor(ownerId);
    const index = events.findIndex((event) => event.id === id);
    if (index !== -1) {
      events.splice(index, 1);
    }
    });
  }
}

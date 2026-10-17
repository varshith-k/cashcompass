import "server-only";

export interface SyncStatus {
  timestamp: string;
  added: number;
  skipped: number;
}

/** Last sync per user (keyed by Auth0 `sub`). */
const lastStatus = new Map<string, SyncStatus>();

export function recordSyncStatus(ownerId: string, result: { added: number; skipped: number }) {
  lastStatus.set(ownerId, { timestamp: new Date().toISOString(), ...result });
}

export function getSyncStatus(ownerId: string): SyncStatus | null {
  return lastStatus.get(ownerId) ?? null;
}

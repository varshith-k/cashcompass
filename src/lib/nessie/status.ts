import "server-only";

export interface SyncStatus {
  timestamp: string;
  added: number;
  skipped: number;
}

let lastStatus: SyncStatus | null = null;

export function recordSyncStatus(result: { added: number; skipped: number }) {
  lastStatus = { timestamp: new Date().toISOString(), ...result };
}

export function getSyncStatus(): SyncStatus | null {
  return lastStatus;
}

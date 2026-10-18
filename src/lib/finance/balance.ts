import "server-only";
import { getPlanningProfile } from "@/lib/storage/profile";
import { DEMO_STARTING_BALANCE } from "./demo-data";
import type { FinancialEvent } from "./types";

export interface BalanceBasis {
  openingBalance: number;
  source: "manual" | "nessie" | "demo" | "unconfigured";
  description: string;
}

/** Account snapshots already include their imported posted events; subtract them before replay. */
export async function getBalanceBasis(ownerId: string): Promise<BalanceBasis> {
  const profile = await getPlanningProfile(ownerId);
  if (profile.openingBalance !== null) return { openingBalance: profile.openingBalance, source: "manual", description: "Forecast uses your confirmed balance checkpoint and recorded activity since that checkpoint." };
  const snapshots = Object.values(profile.accountSnapshots);
  if (snapshots.length) {
    const openingBalance = snapshots.reduce((total, snapshot) => total + snapshot.balance - Object.values(snapshot.reflectedEvents).reduce((sum, amount) => sum + amount, 0), 0);
    return { openingBalance: Math.round(openingBalance * 100) / 100, source: "nessie", description: "Forecast reconciles imported posted activity with the latest synchronized Nessie account balances. Manual activity is applied separately. Nessie is simulated banking data." };
  }
  if (!process.env.DATABASE_URL) return { openingBalance: DEMO_STARTING_BALANCE, source: "demo", description: "Demo forecast uses a seeded opening balance and recorded events." };
  return { openingBalance: 0, source: "unconfigured", description: "No balance checkpoint is configured. Set available funds in Settings or synchronize a Nessie account before relying on this forecast." };
}

export function eventsForBalance(events: FinancialEvent[], basis: BalanceBasis): FinancialEvent[] {
  // Old seeded Nessie fixtures are not records from synchronized accounts.
  return basis.source === "nessie" ? events.filter((event) => event.source !== "nessie" || event.sourceRecordId) : events;
}

import "server-only";
import { getPlanningProfile } from "@/lib/storage/profile";
import { eventsForBalance, getBalanceBasis } from "./balance";
import { getFinancialEventRepository, withFinancialTransaction } from "./repository";

/** Read planning, the balance basis and financial events under the same owner lock. */
export async function getFinancialSnapshot() {
  return withFinancialTransaction(async (ownerId) => {
    const profile = await getPlanningProfile(ownerId);
    const balanceBasis = await getBalanceBasis(ownerId);
    const events = eventsForBalance(await getFinancialEventRepository().listEvents(), balanceBasis);
    return { ownerId, profile, balanceBasis, events };
  });
}

import "server-only";
import { createHash } from "node:crypto";
import { createSandboxAccount, createSandboxCustomer, getAccountsForCustomer, getCustomers, isNessieId } from "./client";

export interface NessieMapping {
  owner_id: string;
  provisioning_token: string;
  customer_id: string | null;
  account_id: string | null;
  customer_attempted: boolean;
  account_attempted: boolean;
}

export interface MappingSession {
  read(): Promise<NessieMapping | null>;
  save(mapping: NessieMapping): Promise<void>;
}

export interface MappingStore {
  withOwnerLock<T>(ownerId: string, work: (session: MappingSession) => Promise<T>): Promise<T>;
}

export class NessieProvisioningError extends Error {}

const reviewMessage = "Sandbox setup needs administrator review: a previous creation request has an uncertain result. No additional account was created. Retry to check whether it has appeared.";

/** Caller supplies only a verified Auth0 subject. Durable attempts precede remote POSTs. */
export async function provisionUserAccount(ownerId: string, store: MappingStore): Promise<NessieMapping> {
  if (!ownerId.trim()) throw new NessieProvisioningError("A verified user is required.");
  return store.withOwnerLock(ownerId, async (session) => {
    const mapping = await session.read() ?? {
      owner_id: ownerId,
      provisioning_token: createHash("sha256").update(`cashcompass:nessie:v1:${ownerId}`).digest("hex").slice(0, 32),
      customer_id: null, account_id: null, customer_attempted: false, account_attempted: false,
    };
    if (mapping.owner_id !== ownerId) throw new NessieProvisioningError("Sandbox ownership mismatch.");
    if (mapping.account_id && mapping.customer_id) return mapping;
    await session.save(mapping);

    if (!mapping.customer_id) {
      if (mapping.customer_attempted) {
        const matches = (await getCustomers()).filter((customer) =>
          customer.first_name === "CashCompass" && customer.last_name === `User${mapping.provisioning_token}`,
        );
        if (matches.length !== 1 || !isNessieId(matches[0]._id)) throw new NessieProvisioningError(reviewMessage);
        mapping.customer_id = matches[0]._id;
      } else {
        mapping.customer_attempted = true;
        await session.save(mapping);
        mapping.customer_id = (await createSandboxCustomer(mapping.provisioning_token))._id;
      }
      await session.save(mapping);
    }

    if (mapping.account_attempted) {
      const matches = (await getAccountsForCustomer(mapping.customer_id)).filter((account) =>
        account.nickname === `CC-${mapping.provisioning_token}` && account.customer_id === mapping.customer_id,
      );
      if (matches.length !== 1 || !isNessieId(matches[0]._id)) throw new NessieProvisioningError(reviewMessage);
      mapping.account_id = matches[0]._id;
    } else {
      mapping.account_attempted = true;
      await session.save(mapping);
      mapping.account_id = (await createSandboxAccount(mapping.customer_id, mapping.provisioning_token))._id;
    }
    await session.save(mapping);
    return mapping;
  });
}

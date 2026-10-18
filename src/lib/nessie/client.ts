import "server-only";

const BASE_URL = process.env.NESSIE_API_BASE_URL || "https://api.nessieisreal.com";

export interface NessieAccount {
  _id: string;
  nickname: string;
  type: string;
  balance: number;
  customer_id?: string;
}

export interface NessieCustomer {
  _id: string;
  first_name: string;
  last_name: string;
}

export interface NessiePurchase {
  _id: string;
  merchant_id: string;
  amount: number;
  purchase_date: string;
  description: string;
  status: string;
}

export interface NessieDeposit {
  _id: string;
  amount: number;
  transaction_date: string;
  description: string;
  status?: string;
}

export interface NessieWithdrawal {
  _id: string;
  amount: number;
  transaction_date: string;
  description: string;
  status?: string;
}

export interface NessieBill {
  _id: string;
  status: string;
  payee: string;
  nickname: string;
  payment_date: string;
  recurring_date: number;
  payment_amount: number;
}

export interface NessieMerchant {
  _id: string;
  name: string;
  /** Merchant tags such as ["Food"]; not always present. */
  category?: string[] | string;
}

class NessieError extends Error {}

function requireApiKey(): string {
  const key = process.env.NESSIE_API_KEY;
  if (!key) throw new NessieError("NESSIE_API_KEY is not set");
  return key;
}

async function get<T>(path: string, options?: { on404?: T }): Promise<T> {
  const key = requireApiKey();
  const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  // Some sandbox versions return 404 for empty collections. Sync separately
  // fetches/validates the account, so a missing account still fails closed.
  if (response.status === 404 && options && "on404" in options) {
    return options.on404 as T;
  }
  if (!response.ok) {
    throw new NessieError(`Nessie request failed: ${response.status} ${path}`);
  }
  return response.json();
}

export function isNessieConfigured(): boolean {
  return Boolean(process.env.NESSIE_API_KEY);
}

export function getAccountsForCustomer(customerId: string) {
  return get<NessieAccount[]>(`/customers/${encodeURIComponent(customerId)}/accounts`, { on404: [] });
}

export function getAccount(accountId: string) {
  return get<NessieAccount>(`/accounts/${encodeURIComponent(accountId)}`);
}

export function getAccountPurchases(accountId: string) {
  return get<NessiePurchase[]>(`/accounts/${accountId}/purchases`, { on404: [] });
}

export function getAccountDeposits(accountId: string) {
  return get<NessieDeposit[]>(`/accounts/${accountId}/deposits`, { on404: [] });
}

export function getAccountWithdrawals(accountId: string) {
  return get<NessieWithdrawal[]>(`/accounts/${accountId}/withdrawals`, { on404: [] });
}

export function getAccountBills(accountId: string) {
  return get<NessieBill[]>(`/accounts/${accountId}/bills`, { on404: [] });
}

export function getMerchant(merchantId: string) {
  return get<NessieMerchant>(`/merchants/${merchantId}`);
}

/** Nessie P2P transfer between two accounts (`type` is "p2p"). */
export interface NessieTransfer {
  _id: string;
  type?: string;
  transaction_date: string;
  status?: string;
  medium?: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  description?: string;
}

/**
 * Nessie object ids: legacy sandbox accounts use a 24-char Mongo ObjectId;
 * the current sandbox (confirmed live, Oct 2026) returns UUIDs instead.
 * Accept either shape rather than guess which one any given account has.
 */
export function isNessieId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[a-f0-9]{24}$/i.test(value) || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

/** Transfers the account sent (payer) and received (payee), de-duplicated by id. */
export async function getAccountTransfers(accountId: string): Promise<NessieTransfer[]> {
  const [sent, received] = await Promise.all([
    get<NessieTransfer[]>(`/accounts/${encodeURIComponent(accountId)}/transfers?type=payer`, { on404: [] }),
    get<NessieTransfer[]>(`/accounts/${encodeURIComponent(accountId)}/transfers?type=payee`, { on404: [] }),
  ]);
  const byId = new Map<string, NessieTransfer>();
  for (const transfer of [...sent, ...received]) byId.set(transfer._id, transfer);
  return [...byId.values()];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const key = requireApiKey();
  const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new NessieError(`Nessie request failed: ${response.status} ${path}`);
  }
  return response.json();
}

export function getCustomers() {
  return get<NessieCustomer[]>("/customers");
}

/** Fictional profile only: never forward an Auth0 name, email, or address. */
export async function createSandboxCustomer(token: string): Promise<NessieCustomer> {
  const result = await post<{ objectCreated?: NessieCustomer } & Partial<NessieCustomer>>("/customers", {
    first_name: "CashCompass",
    last_name: `User${token}`,
    address: { street_number: "123", street_name: "Campus Ave", city: "Columbia", state: "MO", zip: "65201" },
  });
  const created = result.objectCreated ?? result as NessieCustomer;
  if (!isNessieId(created?._id)) throw new NessieError("Nessie did not return the created customer");
  return created;
}

export async function createSandboxAccount(customerId: string, token: string): Promise<NessieAccount> {
  if (!isNessieId(customerId)) throw new NessieError("Invalid Nessie customer id");
  const result = await post<{ objectCreated?: NessieAccount } & Partial<NessieAccount>>(
    `/customers/${encodeURIComponent(customerId)}/accounts`,
    { type: "Checking", nickname: `CC-${token}`, rewards: 0, balance: 0 },
  );
  const created = result.objectCreated ?? result as NessieAccount;
  if (!isNessieId(created?._id) || created.customer_id !== customerId) throw new NessieError("Nessie did not return the owned account");
  return created;
}

/** Sends a sandbox P2P transfer from one account to another. Returns the created transfer. */
export async function createTransfer(
  payerAccountId: string,
  transfer: { payeeAccountId: string; amount: number; description: string },
): Promise<NessieTransfer> {
  if (!isNessieId(payerAccountId) || !isNessieId(transfer.payeeAccountId)) throw new NessieError("Invalid Nessie account id");
  const result = await post<{ objectCreated?: NessieTransfer } & Partial<NessieTransfer>>(
    `/accounts/${encodeURIComponent(payerAccountId)}/transfers`,
    {
      medium: "balance",
      payee_id: transfer.payeeAccountId,
      amount: Math.round(transfer.amount * 100) / 100,
      transaction_date: new Date().toISOString().slice(0, 10),
      description: transfer.description.slice(0, 120),
    },
  );
  const created = result.objectCreated ?? (result as NessieTransfer);
  if (!created?._id) throw new NessieError("Nessie did not return the created transfer");
  return created;
}

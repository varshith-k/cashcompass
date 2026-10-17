import "server-only";

const BASE_URL = process.env.NESSIE_API_BASE_URL || "http://api.nessieisreal.com";

export interface NessieAccount {
  _id: string;
  nickname: string;
  type: string;
  balance: number;
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
}

class NessieError extends Error {}

function requireApiKey(): string {
  const key = process.env.NESSIE_API_KEY;
  if (!key) throw new NessieError("NESSIE_API_KEY is not set");
  return key;
}

async function get<T>(path: string): Promise<T> {
  const key = requireApiKey();
  const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new NessieError(`Nessie request failed: ${response.status} ${path}`);
  }
  return response.json();
}

export function isNessieConfigured(): boolean {
  return Boolean(process.env.NESSIE_API_KEY);
}

export function getAccountsForCustomer(customerId: string) {
  return get<NessieAccount[]>(`/customers/${customerId}/accounts`);
}

export function getAccount(accountId: string) {
  return get<NessieAccount>(`/accounts/${encodeURIComponent(accountId)}`);
}

export function getAccountPurchases(accountId: string) {
  return get<NessiePurchase[]>(`/accounts/${accountId}/purchases`);
}

export function getAccountDeposits(accountId: string) {
  return get<NessieDeposit[]>(`/accounts/${accountId}/deposits`);
}

export function getAccountWithdrawals(accountId: string) {
  return get<NessieWithdrawal[]>(`/accounts/${accountId}/withdrawals`);
}

export function getAccountBills(accountId: string) {
  return get<NessieBill[]>(`/accounts/${accountId}/bills`);
}

export function getMerchant(merchantId: string) {
  return get<NessieMerchant>(`/merchants/${merchantId}`);
}

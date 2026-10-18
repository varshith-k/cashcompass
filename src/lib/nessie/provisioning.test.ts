import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MappingStore, NessieMapping } from "./provisioning";

vi.mock("./client", async (original) => ({
  ...await original<typeof import("./client")>(),
  createSandboxCustomer: vi.fn(), createSandboxAccount: vi.fn(), getCustomers: vi.fn(), getAccountsForCustomer: vi.fn(),
}));
import { createSandboxCustomer, createSandboxAccount, getCustomers, getAccountsForCustomer } from "./client";
import { provisionUserAccount } from "./provisioning";

function memoryStore() {
  const rows = new Map<string, NessieMapping>();
  const locks = new Set<string>();
  const store: MappingStore = {
    async withOwnerLock(ownerId, work) {
      if (locks.has(ownerId)) throw new Error("busy");
      locks.add(ownerId);
      try {
        return await work({ read: async () => structuredClone(rows.get(ownerId) ?? null), save: async (row) => { rows.set(ownerId, structuredClone(row)); } });
      } finally { locks.delete(ownerId); }
    },
  };
  return { store, rows };
}
const customerId = "a".repeat(24);
const accountId = "b".repeat(24);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createSandboxCustomer).mockResolvedValue({ _id: customerId, first_name: "CashCompass", last_name: "User" });
  vi.mocked(createSandboxAccount).mockResolvedValue({ _id: accountId, customer_id: customerId, nickname: "Mine", balance: 0, type: "Checking" });
});

describe("durable per-user Nessie provisioning", () => {
  it("reuses the saved account on repeat logins and after a service restart", async () => {
    const { store, rows } = memoryStore();
    const first = await provisionUserAccount("auth0|alice", store);
    expect(first).toMatchObject({ owner_id: "auth0|alice", customer_id: customerId, account_id: accountId });
    const restartedStore: MappingStore = { withOwnerLock: async (ownerId, work) => work({ read: async () => structuredClone(rows.get(ownerId)!), save: async () => { throw new Error("should not write"); } }) };
    expect(await provisionUserAccount("auth0|alice", restartedStore)).toEqual(first);
    expect(createSandboxCustomer).toHaveBeenCalledTimes(1);
    expect(createSandboxAccount).toHaveBeenCalledTimes(1);
  });

  it("uses a different pseudonymous marker for each owner", async () => {
    const { store } = memoryStore();
    await provisionUserAccount("auth0|alice", store);
    await provisionUserAccount("auth0|bob", store);
    const tokens = vi.mocked(createSandboxCustomer).mock.calls.map(([token]) => token);
    expect(new Set(tokens).size).toBe(2);
    expect(tokens.every((token) => /^[a-f0-9]{32}$/.test(token))).toBe(true);
    expect(tokens.join()).not.toMatch(/alice|bob/);
  });

  it("checkpoints the customer before account creation and recovers an uncertain account POST", async () => {
    const { store, rows } = memoryStore();
    vi.mocked(createSandboxAccount).mockRejectedValueOnce(new Error("timeout after remote commit"));
    await expect(provisionUserAccount("auth0|alice", store)).rejects.toThrow("timeout");
    const checkpoint = rows.get("auth0|alice")!;
    expect(checkpoint).toMatchObject({ customer_id: customerId, account_id: null, account_attempted: true });
    vi.mocked(getAccountsForCustomer).mockResolvedValue([{ _id: accountId, customer_id: customerId, nickname: `CC-${checkpoint.provisioning_token}`, balance: 0, type: "Checking" }]);
    expect((await provisionUserAccount("auth0|alice", store)).account_id).toBe(accountId);
    expect(createSandboxCustomer).toHaveBeenCalledTimes(1);
    expect(createSandboxAccount).toHaveBeenCalledTimes(1);
  });

  it("recovers a customer POST whose response was lost without creating another customer", async () => {
    const { store, rows } = memoryStore();
    vi.mocked(createSandboxCustomer).mockRejectedValueOnce(new Error("connection lost"));
    await expect(provisionUserAccount("auth0|alice", store)).rejects.toThrow();
    const checkpoint = rows.get("auth0|alice")!;
    vi.mocked(getCustomers).mockResolvedValue([{ _id: customerId, first_name: "CashCompass", last_name: `User${checkpoint.provisioning_token}` }]);
    expect((await provisionUserAccount("auth0|alice", store)).account_id).toBe(accountId);
    expect(createSandboxCustomer).toHaveBeenCalledTimes(1);
  });

  it.each([{ accounts: [] }, { accounts: [{ _id: accountId, customer_id: "wrong", nickname: "wrong", balance: 0, type: "Checking" }] }])("does not blindly POST again when recovery finds no owned account", async ({ accounts }) => {
    const { store } = memoryStore();
    vi.mocked(createSandboxAccount).mockRejectedValue(new Error("timeout"));
    await expect(provisionUserAccount("auth0|alice", store)).rejects.toThrow();
    vi.mocked(getAccountsForCustomer).mockResolvedValue(accounts);
    await expect(provisionUserAccount("auth0|alice", store)).rejects.toThrow("administrator review");
    expect(createSandboxAccount).toHaveBeenCalledTimes(1);
  });

  it("does not retry a customer POST when a recovery GET fails or returns no match", async () => {
    const { store } = memoryStore();
    vi.mocked(createSandboxCustomer).mockRejectedValue(new Error("timeout"));
    await expect(provisionUserAccount("auth0|alice", store)).rejects.toThrow();
    vi.mocked(getCustomers).mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
    await expect(provisionUserAccount("auth0|alice", store)).rejects.toThrow("offline");
    await expect(provisionUserAccount("auth0|alice", store)).rejects.toThrow("administrator review");
    expect(createSandboxCustomer).toHaveBeenCalledTimes(1);
    expect(createSandboxAccount).not.toHaveBeenCalled();
  });

  it("refuses ambiguous duplicate recovery matches", async () => {
    const { store, rows } = memoryStore();
    vi.mocked(createSandboxAccount).mockRejectedValueOnce(new Error("timeout"));
    await expect(provisionUserAccount("auth0|alice", store)).rejects.toThrow();
    const account = { _id: accountId, customer_id: customerId, nickname: `CC-${rows.get("auth0|alice")!.provisioning_token}`, balance: 0, type: "Checking" };
    vi.mocked(getAccountsForCustomer).mockResolvedValue([account, { ...account, _id: "c".repeat(24) }]);
    await expect(provisionUserAccount("auth0|alice", store)).rejects.toThrow("administrator review");
  });

  it("rejects a concurrent setup instead of sending a second POST", async () => {
    const { store } = memoryStore();
    let release!: (customer: Awaited<ReturnType<typeof createSandboxCustomer>>) => void;
    vi.mocked(createSandboxCustomer).mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const first = provisionUserAccount("auth0|alice", store);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    await expect(provisionUserAccount("auth0|alice", store)).rejects.toThrow("busy");
    release({ _id: customerId, first_name: "CashCompass", last_name: "User" });
    await first;
    expect(createSandboxCustomer).toHaveBeenCalledTimes(1);
  });
});

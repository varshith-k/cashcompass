import { afterEach, describe, expect, it, vi } from "vitest";
import { createSandboxCustomer, createSandboxAccount, getAccount, getAccountBills, getAccountDeposits, getAccountPurchases, getAccountTransfers, getAccountWithdrawals } from "./client";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Nessie sandbox API contracts", () => {
  it("posts fictional profiles and $0 checking accounts, accepting wrapped and direct responses", async () => {
    vi.stubEnv("NESSIE_API_KEY", "test-key");
    const customerId = "a".repeat(24);
    const accountId = "b".repeat(24);
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ objectCreated: { _id: customerId, first_name: "CashCompass", last_name: "Usertoken" } }))
      .mockResolvedValueOnce(Response.json({ _id: accountId, customer_id: customerId, balance: 0, type: "Checking", nickname: "CC-token" }));
    vi.stubGlobal("fetch", fetcher);
    await createSandboxCustomer("token");
    await createSandboxAccount(customerId, "token");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ first_name: "CashCompass", last_name: "Usertoken", address: expect.any(Object) });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ type: "Checking", nickname: "CC-token", rewards: 0, balance: 0 });
  });
  it("rejects a creation response for a different customer", async () => {
    vi.stubEnv("NESSIE_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ _id: "b".repeat(24), customer_id: "someone-else" })));
    await expect(createSandboxAccount("a".repeat(24), "token")).rejects.toThrow("owned account");
  });
  it("treats empty collection 404s as empty but rejects an account 404", async () => {
    vi.stubEnv("NESSIE_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(null, { status: 404 })));
    for (const load of [getAccountBills, getAccountDeposits, getAccountPurchases, getAccountTransfers, getAccountWithdrawals]) {
      expect(await load("a".repeat(24))).toEqual([]);
    }
    await expect(getAccount("a".repeat(24))).rejects.toThrow("404");
  });
});

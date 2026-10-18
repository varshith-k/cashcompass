import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ owner: "auth0|alice", source: "auth0", configured: true, mapping: vi.fn(), getAccount: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireSession: async () => ({ source: state.source, user: { id: state.owner } }) }));
vi.mock("./mapping-store", () => ({ getNessieMappingStore: () => ({ get: state.mapping }) }));
vi.mock("./client", () => ({ isNessieConfigured: () => state.configured, getAccount: state.getAccount }));
import { listUserAccounts } from "./accounts";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "configured-test-only");
  vi.stubEnv("NESSIE_ACCOUNT_ID", "legacy-shared-account");
  state.owner = "auth0|alice"; state.source = "auth0"; state.configured = true;
  state.mapping.mockReset(); state.getAccount.mockReset();
});

describe("owner-scoped sandbox account selection", () => {
  it("loads only the verified session owner's mapping and validates the remote customer", async () => {
    state.mapping.mockImplementation(async (owner) => ({ account_id: `${owner}-account`, customer_id: `${owner}-customer` }));
    state.getAccount.mockImplementation(async (id) => ({ _id: id, customer_id: id.replace("-account", "-customer") }));
    expect((await listUserAccounts()).accounts[0]._id).toBe("auth0|alice-account");
    state.owner = "auth0|bob";
    expect((await listUserAccounts()).accounts[0]._id).toBe("auth0|bob-account");
    expect(state.getAccount).not.toHaveBeenCalledWith("legacy-shared-account");
  });
  it("rejects a remote account with a different customer or id", async () => {
    state.mapping.mockResolvedValue({ account_id: "mine", customer_id: "my-customer" });
    state.getAccount.mockResolvedValue({ _id: "mine", customer_id: "someone-else" });
    expect(await listUserAccounts()).toMatchObject({ accounts: [], error: expect.stringContaining("ownership") });
    state.getAccount.mockResolvedValue({ _id: "someone-else", customer_id: "my-customer" });
    expect((await listUserAccounts()).accounts).toEqual([]);
  });
  it("never falls back to shared accounts if the mapping is absent", async () => {
    state.mapping.mockResolvedValue(null);
    expect(await listUserAccounts()).toEqual({ accounts: [] });
    expect(state.getAccount).not.toHaveBeenCalled();
  });
  it("does not access Nessie or the mapping database in demo mode or without durable storage", async () => {
    state.source = "demo";
    expect((await listUserAccounts()).accounts).toEqual([]);
    state.source = "auth0"; vi.stubEnv("DATABASE_URL", "");
    expect((await listUserAccounts()).error).toContain("DATABASE_URL");
    expect(state.mapping).not.toHaveBeenCalled();
    expect(state.getAccount).not.toHaveBeenCalled();
  });
  it("does not expose provider or database exception contents", async () => {
    state.mapping.mockRejectedValue(new Error("postgres://secret:password@host"));
    expect(JSON.stringify(await listUserAccounts())).not.toContain("password");
  });
});

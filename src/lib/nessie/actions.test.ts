import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ source: "auth0", owner: "auth0|alice", accounts: [{ _id: "alice-account" }], provision: vi.fn(), sync: vi.fn(), configured: true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireOwnerId: async () => state.owner, requireSession: async () => ({ source: state.source, user: { id: state.owner } }) }));
vi.mock("./accounts", () => ({ listUserAccounts: async () => ({ accounts: state.accounts }) }));
vi.mock("./mapping-store", () => ({ getNessieMappingStore: () => "trusted-server-store" }));
vi.mock("./provisioning", async (original) => ({ ...await original<typeof import("./provisioning")>(), provisionUserAccount: state.provision }));
vi.mock("./sync", () => ({ syncNessieAccount: state.sync }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), isNessieConfigured: () => state.configured }));
vi.mock("@/lib/finance/friends", () => ({ getFriends: async () => [] }));
vi.mock("./status", () => ({ recordSyncStatus: vi.fn(async () => {}) }));
import { setupNessieAccount, syncNessie } from "./actions";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "configured-test-only");
  vi.stubEnv("NESSIE_ACCOUNT_ID", "legacy-account");
  state.source = "auth0"; state.owner = "auth0|alice"; state.configured = true;
  state.accounts = [{ _id: "alice-account" }]; state.provision.mockReset(); state.sync.mockReset();
});

describe("authenticated Nessie actions", () => {
  it("rejects another user's selected account before fetching or importing activity", async () => {
    expect((await syncNessie("bob-account")).ok).toBe(false);
    expect(state.sync).not.toHaveBeenCalled();
  });
  it("ignores legacy shared account configuration when choosing the default", async () => {
    state.sync.mockResolvedValue({ added: 0, skipped: 0, accountId: "alice-account" });
    expect((await syncNessie()).ok).toBe(true);
    expect(state.sync).toHaveBeenCalledWith("alice-account", expect.any(Object));
    state.accounts = [];
    expect((await syncNessie()).ok).toBe(false);
    expect(state.sync).toHaveBeenCalledTimes(1);
  });
  it("provisions only the verified session identity", async () => {
    expect((await setupNessieAccount()).ok).toBe(true);
    expect(state.provision).toHaveBeenCalledWith("auth0|alice", "trusted-server-store");
  });
  it("does not create external accounts for demo sessions or without required configuration", async () => {
    state.source = "demo";
    expect((await setupNessieAccount()).ok).toBe(false);
    state.source = "auth0"; vi.stubEnv("DATABASE_URL", "");
    expect((await setupNessieAccount()).ok).toBe(false);
    state.configured = false; vi.stubEnv("DATABASE_URL", "configured-test-only");
    expect((await setupNessieAccount()).ok).toBe(false);
    expect(state.provision).not.toHaveBeenCalled();
  });
  it("does not claim readiness when the mapped account cannot be verified", async () => {
    state.accounts = [];
    expect((await setupNessieAccount()).ok).toBe(false);
  });
  it("does not expose database/provider exception values", async () => {
    state.provision.mockRejectedValue(new Error("postgres://secret:password@host"));
    expect(JSON.stringify(await setupNessieAccount())).not.toContain("password");
  });
});

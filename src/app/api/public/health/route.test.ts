import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/storage/transaction", () => ({ withDatabaseClient: (work: (client: typeof database) => unknown) => work(database) }));
import { GET } from "./route";
beforeEach(() => {
  for (const key of ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET", "DATABASE_URL"]) vi.stubEnv(key, "test-only-must-not-be-returned");
  database.query.mockResolvedValue({ rows: [{ ready: true }] });
});
afterEach(() => vi.unstubAllEnvs());
describe("public readiness", () => {
  it("reports a safe build identity when core configuration and migrations are ready", async () => {
    vi.stubEnv("CASHCOMPASS_BUILD_SHA", "a".repeat(40));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", revision: "a".repeat(40) });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("fails readiness for missing authentication or unapplied migrations", async () => {
    vi.stubEnv("AUTH0_SECRET", "");
    expect((await GET()).status).toBe(503);
    vi.stubEnv("AUTH0_SECRET", "test-only");
    database.query.mockResolvedValue({ rows: [{ ready: false }] });
    expect((await GET()).status).toBe(503);
  });
  it("does not expose credentials or database errors", async () => {
    database.query.mockRejectedValue(new Error("postgres://test-only-must-not-be-returned"));
    const response = await GET();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("test-only");
    expect(text).not.toContain("postgres");
  });
});

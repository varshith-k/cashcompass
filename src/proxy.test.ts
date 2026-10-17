import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";

let proxy: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  vi.stubEnv("AUTH0_DOMAIN", "cashcompass-test.us.auth0.com");
  vi.stubEnv("AUTH0_CLIENT_ID", "test-client-id");
  vi.stubEnv("AUTH0_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("AUTH0_SECRET", SECRET);
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
  ({ proxy } = await import("@/proxy"));
});

async function sessionCookie(sub: string) {
  const value = await generateSessionCookie(
    {
      user: { sub, name: "Test User", email: "test@example.com" },
      tokenSet: { accessToken: "at", expiresAt: Math.floor(Date.now() / 1000) + 3600 },
      internal: { sid: "sid", createdAt: Math.floor(Date.now() / 1000) },
    },
    { secret: SECRET },
  );
  return `__session=${value}`;
}

function request(path: string, cookie?: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("proxy route protection", () => {
  it("lets signed-out users see the landing page", async () => {
    const res = await proxy(request("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects signed-out page requests to Universal Login with returnTo", async () => {
    const res = await proxy(request("/dashboard?tab=bills"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/auth/login");
    expect(location.searchParams.get("returnTo")).toBe("/dashboard?tab=bills");
  });

  it("rejects signed-out API requests with 401 JSON", async () => {
    const res = await proxy(request("/api/auth/me"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthorized" });
  });

  it("rejects a forged/garbage session cookie", async () => {
    const res = await proxy(request("/api/auth/me", "__session=not-a-real-session"));
    expect(res.status).toBe(401);
  });

  it("allows signed-in users through to pages and APIs", async () => {
    const cookie = await sessionCookie("auth0|alice");
    for (const path of ["/overview", "/settings", "/api/auth/me"]) {
      const res = await proxy(request(path, cookie));
      expect(res.status, path).toBe(200);
      expect(res.headers.get("location"), path).toBeNull();
    }
  });

  it("turns an Auth0 outage on login into the friendly error page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));
    try {
      const res = await proxy(request("/auth/login?returnTo=%2Fbudgets"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/auth-error?code=unavailable");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("runs ungated in demo mode (no Auth0 credentials, non-production)", async () => {
    vi.stubEnv("AUTH0_CLIENT_SECRET", "");
    try {
      const page = await proxy(request("/overview"));
      expect(page.status).toBe(200);
      expect(page.headers.get("location")).toBeNull();
      const login = await proxy(request("/auth/login"));
      expect(login.headers.get("location")).toBe("http://localhost:3000/overview");
    } finally {
      vi.stubEnv("AUTH0_CLIENT_SECRET", "test-client-secret");
    }
  });

  it("fails closed with a friendly page when production lacks Auth0 config", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH0_DOMAIN", "");
    try {
      const page = await proxy(request("/overview"));
      expect(page.headers.get("location")).toBe("http://localhost:3000/auth-error?code=configuration");
      const api = await proxy(request("/api/auth/me"));
      expect(api.status).toBe(503);
      expect((await proxy(request("/auth-error"))).status).toBe(200);
    } finally {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("AUTH0_DOMAIN", "cashcompass-test.us.auth0.com");
    }
  });

  it("rejects a cookie encrypted with a different secret", async () => {
    const forged = await generateSessionCookie(
      { user: { sub: "auth0|mallory" }, tokenSet: { accessToken: "x", expiresAt: 9999999999 }, internal: { sid: "s", createdAt: 0 } },
      { secret: "attacker-secret-ffffffffffffffffffffffffffffffff" },
    );
    const res = await proxy(request("/api/auth/me", `__session=${forged}`));
    expect(res.status).toBe(401);
  });
});

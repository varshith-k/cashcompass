import { describe, expect, it } from "vitest";

import { isAuth0Configured, isDemoAuthMode } from "@/lib/auth/config";
import { classifyAuthError } from "@/lib/auth/errors";
import { signInMethodLabel, toAuthUser } from "@/lib/auth/map-user";
import { assertOwnedBy, ForbiddenResourceError, onlyOwnedBy, withOwner } from "@/lib/auth/ownership";
import { isApiPath, isPublicPath, loginHref, safeReturnTo, signupHref } from "@/lib/auth/routes";
import type { AuthUser } from "@/lib/auth/types";

const alice: AuthUser = { id: "auth0|alice", name: "Alice Doe", email: "alice@example.com" };
const bob: AuthUser = { id: "google-oauth2|bob", name: "Bob", email: "bob@example.com" };

describe("toAuthUser", () => {
  it("maps sub to id, picture to avatarUrl, and drops other claims", () => {
    expect(
      toAuthUser({ sub: "auth0|1", name: "Ada", email: "a@x.io", picture: "https://p/x.png", email_verified: true } as never),
    ).toEqual({ id: "auth0|1", name: "Ada", email: "a@x.io", avatarUrl: "https://p/x.png" });
  });

  it("fills required display fields when the IdP omits them", () => {
    expect(toAuthUser({ sub: "auth0|2", nickname: "ada" })).toEqual({ id: "auth0|2", name: "ada", email: "" });
    expect(toAuthUser({ sub: "auth0|3", email: "grace@navy.mil" })).toEqual({
      id: "auth0|3",
      name: "grace",
      email: "grace@navy.mil",
    });
    expect(toAuthUser({ sub: "auth0|4" })?.name).toBe("CashCompass member");
  });

  it("returns null without a usable sub", () => {
    expect(toAuthUser(null)).toBeNull();
    expect(toAuthUser({ email: "a@x.io" })).toBeNull();
    expect(toAuthUser({ sub: "  " })).toBeNull();
  });
});

describe("signInMethodLabel", () => {
  it("names the identity provider from the sub prefix", () => {
    expect(signInMethodLabel("google-oauth2|123")).toBe("Google");
    expect(signInMethodLabel("auth0|abc")).toBe("Email");
    expect(signInMethodLabel("samlp|corp|x")).toBe("Auth0");
  });
});

describe("demo mode", () => {
  const full = { AUTH0_DOMAIN: "t.auth0.com", AUTH0_CLIENT_ID: "id", AUTH0_CLIENT_SECRET: "s", AUTH0_SECRET: "x" };

  it("uses Auth0 whenever it is configured", () => {
    expect(isAuth0Configured(full as never)).toBe(true);
    expect(isDemoAuthMode({ ...full, NODE_ENV: "development" } as never)).toBe(false);
  });

  it("falls back to the demo user only outside production", () => {
    expect(isDemoAuthMode({ NODE_ENV: "development" } as never)).toBe(true);
    expect(isDemoAuthMode({ ...full, AUTH0_SECRET: " ", NODE_ENV: "development" } as never)).toBe(true);
    expect(isDemoAuthMode({ NODE_ENV: "production" } as never)).toBe(false);
  });
});

describe("route policy", () => {
  it.each(["/", "/auth-error", "/auth/login", "/auth/callback", "/api/public/status"])("%s is public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/overview", "/transactions/123", "/settings", "/api/auth/me", "/api/transactions", "/authx", "/auth"])(
    "%s is protected",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );

  it("detects API paths", () => {
    expect(isApiPath("/api/auth/me")).toBe(true);
    expect(isApiPath("/apiary")).toBe(false);
  });
});

describe("safeReturnTo", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeReturnTo("/budgets?month=10")).toBe("/budgets?month=10");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "/auth/logout", "/auth-error", "", null])(
    "rejects %s",
    (value) => {
      expect(safeReturnTo(value)).toBe("/overview");
    },
  );
});

describe("login hrefs", () => {
  it("builds Universal Login URLs", () => {
    expect(loginHref()).toBe("/auth/login?returnTo=%2Foverview");
    expect(signupHref({ returnTo: "/wishlist" })).toBe("/auth/login?returnTo=%2Fwishlist&screen_hint=signup");
    expect(loginHref({ connection: "google-oauth2" })).toBe("/auth/login?returnTo=%2Foverview&connection=google-oauth2");
    expect(loginHref({ returnTo: "https://evil.com" })).toBe("/auth/login?returnTo=%2Foverview");
  });
});

describe("classifyAuthError", () => {
  it("maps SDK codes to safe categories", () => {
    expect(classifyAuthError("access_denied")).toBe("access_denied");
    expect(classifyAuthError("missing_state")).toBe("session_expired");
    expect(classifyAuthError("discovery_error")).toBe("unavailable");
    expect(classifyAuthError("<script>")).toBe("unknown");
    expect(classifyAuthError(undefined)).toBe("unknown");
  });
});

describe("ownership", () => {
  it("stamps the server-verified owner and ignores client-supplied ownerId", () => {
    const record = withOwner(alice, { amount: 12, ownerId: bob.id });
    expect(record).toEqual({ amount: 12, ownerId: alice.id });
  });

  it("blocks cross-user access", () => {
    const bobsBill = { id: "b1", ownerId: bob.id };
    expect(() => assertOwnedBy(bobsBill, alice)).toThrow(ForbiddenResourceError);
    expect(() => assertOwnedBy(null, alice)).toThrow(ForbiddenResourceError);
    expect(assertOwnedBy(bobsBill, bob)).toBe(bobsBill);
  });

  it("filters lists to the current user", () => {
    const rows = [
      { id: 1, ownerId: alice.id },
      { id: 2, ownerId: bob.id },
    ];
    expect(onlyOwnedBy(rows, alice)).toEqual([{ id: 1, ownerId: alice.id }]);
  });
});

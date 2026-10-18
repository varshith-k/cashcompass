import { beforeEach, describe, expect, it, vi } from "vitest";

import { isRecentLogin, toLoginSecurityLevel } from "./login-security";

const auth = vi.hoisted(() => ({
  source: "auth0" as "auth0" | "demo",
  enabled: true,
  saved: undefined as unknown,
  createdAt: undefined as number | undefined,
  fail: false,
}));
const setMock = vi.hoisted(() => vi.fn(async (_id: string, level: string) => void (auth.saved = level)));

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: async () => ({ internal: { createdAt: auth.createdAt } }) } }));
vi.mock("./session", () => ({ requireSession: async () => ({ user: { id: "auth0|me", name: "Me", email: "me@example.com" }, source: auth.source }) }));
vi.mock("./management", () => ({
  isLoginSecurityEnabled: () => auth.enabled,
  getAuth0LoginSecurity: async () => {
    if (auth.fail) throw new Error("boom");
    return { level: auth.saved, emailVerified: true };
  },
  setAuth0LoginSecurity: setMock,
}));

import { setAuthenticatorApp } from "./security-actions";

describe("login security rules", () => {
  it("is off unless the user turned it on", () => {
    expect(toLoginSecurityLevel(undefined)).toBe("off");
    expect(toLoginSecurityLevel("email")).toBe("off");
    expect(toLoginSecurityLevel("app")).toBe("app");
  });

  it("counts a sign-in as recent for 10 minutes", () => {
    const now = 1_800_000_000_000;
    expect(isRecentLogin(now / 1000 - 60, now)).toBe(true);
    expect(isRecentLogin(now / 1000 - 11 * 60, now)).toBe(false);
    expect(isRecentLogin(undefined, now)).toBe(false);
  });
});

describe("setAuthenticatorApp", () => {
  beforeEach(() => {
    Object.assign(auth, { source: "auth0", enabled: true, saved: undefined, createdAt: undefined, fail: false });
    setMock.mockClear();
  });

  it("turns the authenticator app on for the signed-in user", async () => {
    const res = await setAuthenticatorApp(true);
    expect(res).toMatchObject({ ok: true, level: "app" });
    expect(setMock).toHaveBeenCalledWith("auth0|me", "app");
  });

  it("only turns it off after a recent sign-in", async () => {
    auth.saved = "app";
    auth.createdAt = Math.floor(Date.now() / 1000) - 3600;
    expect(await setAuthenticatorApp(false)).toMatchObject({ ok: false });
    expect(setMock).not.toHaveBeenCalled();

    auth.createdAt = Math.floor(Date.now() / 1000) - 60;
    expect(await setAuthenticatorApp(false)).toMatchObject({ ok: true, level: "off" });
    expect(auth.saved).toBe("off");
  });

  it("is unavailable in demo mode or before the Auth0 side is set up", async () => {
    auth.source = "demo";
    expect((await setAuthenticatorApp(true)).ok).toBe(false);
    auth.source = "auth0";
    auth.enabled = false;
    expect((await setAuthenticatorApp(true)).ok).toBe(false);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("reports Auth0 failures without throwing", async () => {
    auth.fail = true;
    expect(await setAuthenticatorApp(true)).toEqual({ ok: false, message: "We couldn't save that. Please try again." });
  });
});

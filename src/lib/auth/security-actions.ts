"use server";

import { auth0 } from "@/lib/auth0";
import { isRecentLogin, toLoginSecurityLevel, type LoginSecurityLevel } from "./login-security";
import { getAuth0LoginSecurity, isLoginSecurityEnabled, setAuth0LoginSecurity } from "./management";
import { requireSession } from "./session";

export type LoginSecurityResult = { ok: true; level: LoginSecurityLevel; message: string } | { ok: false; message: string };

const SAVED: Record<LoginSecurityLevel, string> = {
  email: "Authenticator app turned off. You'll get a code by email when you sign in.",
  app: "Authenticator app turned on. On your next sign-in, scan the QR code with your authenticator app.",
};

/** Turns the optional authenticator app (MFA) on or off for the signed-in user. 2FA by email stays on either way. */
export async function setAuthenticatorApp(enabled: boolean): Promise<LoginSecurityResult> {
  const session = await requireSession();
  if (session.source !== "auth0" || !isLoginSecurityEnabled()) {
    return { ok: false, message: "Sign-in security settings aren't available on this deployment." };
  }
  if (typeof enabled !== "boolean") return { ok: false, message: "Something went wrong. Please try again." };
  const level: LoginSecurityLevel = enabled ? "app" : "email";

  try {
    // The id comes from the verified session, never from the browser.
    const current = toLoginSecurityLevel((await getAuth0LoginSecurity(session.user.id)).level);
    if (current === level) return { ok: true, level, message: SAVED[level] };

    if (!enabled) {
      const raw = await auth0.getSession();
      if (!isRecentLogin(raw?.internal?.createdAt)) {
        return { ok: false, message: "For your safety, sign out and back in, then turn this off within 10 minutes." };
      }
    }

    await setAuth0LoginSecurity(session.user.id, level);
    return { ok: true, level, message: SAVED[level] };
  } catch (error) {
    console.error("[auth] login security update failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, message: "We couldn't save that. Please try again." };
  }
}

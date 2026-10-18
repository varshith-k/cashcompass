// Every account signs in with two-factor (2FA): after the password or Google
// sign-in, Auth0 emails a 6-digit code. Users can opt in to multi-factor
// (MFA) with an authenticator app instead, in Settings.
//
// The choice is stored on the Auth0 user (app_metadata.login_security) and the
// post-login Action in docs/auth0-actions/login-security.js enforces it on
// Auth0's login page, so CashCompass never handles the codes itself.

export const LOGIN_SECURITY_LEVELS = ["email", "app"] as const;
export type LoginSecurityLevel = (typeof LOGIN_SECURITY_LEVELS)[number];

/** How long after signing in a user may switch the authenticator app off again. */
export const RECENT_LOGIN_SECONDS = 10 * 60;

export function isLoginSecurityLevel(value: unknown): value is LoginSecurityLevel {
  return typeof value === "string" && (LOGIN_SECURITY_LEVELS as readonly string[]).includes(value);
}

/** Anything unknown or missing means the default: the emailed code. */
export function toLoginSecurityLevel(value: unknown): LoginSecurityLevel {
  return value === "app" ? "app" : "email";
}

/** Turning the authenticator app off needs a fresh sign-in, so a stolen or forgotten session can't weaken it. */
export function isRecentLogin(sessionCreatedAtSeconds: number | undefined, nowMs = Date.now()): boolean {
  if (!sessionCreatedAtSeconds) return false;
  return nowMs / 1000 - sessionCreatedAtSeconds <= RECENT_LOGIN_SECONDS;
}

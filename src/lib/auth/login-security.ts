// Optional two-factor sign-in, chosen per user in Settings. Off by default.
// Users who turn it on are asked for a code from an authenticator app after
// their password or Google sign-in. (Auth0 can only email a code to users who
// already have another factor, so email can't be the default for everyone.)
//
// The choice is stored on the Auth0 user (app_metadata.login_security) and the
// post-login Action in docs/auth0-actions/login-security.js enforces it on
// Auth0's login page, so CashCompass never handles the codes itself.

export const LOGIN_SECURITY_LEVELS = ["off", "app"] as const;
export type LoginSecurityLevel = (typeof LOGIN_SECURITY_LEVELS)[number];

/** How long after signing in a user may switch two-factor off again. */
export const RECENT_LOGIN_SECONDS = 10 * 60;

/** Anything unknown or missing means off. */
export function toLoginSecurityLevel(value: unknown): LoginSecurityLevel {
  return value === "app" ? "app" : "off";
}

/** Turning two-factor off needs a fresh sign-in, so a stolen or forgotten session can't weaken it. */
export function isRecentLogin(sessionCreatedAtSeconds: number | undefined, nowMs = Date.now()): boolean {
  if (!sessionCreatedAtSeconds) return false;
  return nowMs / 1000 - sessionCreatedAtSeconds <= RECENT_LOGIN_SECONDS;
}

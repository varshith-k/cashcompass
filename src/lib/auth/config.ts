// Decides whether real Auth0 or the built-in demo user backs the session.
// No `server-only`: proxy.ts imports it too. Reads server env vars only.

const REQUIRED_AUTH0_ENV = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET"] as const;

export function isAuth0Configured(env: NodeJS.ProcessEnv = process.env): boolean {
  return REQUIRED_AUTH0_ENV.every((key) => Boolean(env[key]?.trim()));
}

/**
 * Demo mode keeps the app usable for teammates without Auth0 credentials:
 * every request is the DEMO_USER and no route is gated. It is never enabled
 * in production builds; there, missing credentials mean nobody can sign in.
 */
export function isDemoAuthMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isAuth0Configured(env) && env.NODE_ENV !== "production";
}

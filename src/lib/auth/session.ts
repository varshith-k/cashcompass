import "server-only";
import { connection } from "next/server";
import type { AuthSession } from "./types";
import { DEMO_USER } from "./demo-user";

/**
 * Server-side session lookup. This is the seam where the Auth0 integration
 * plugs in (see src/lib/auth/README.md) — swap the body for a call into
 * `@auth0/nextjs-auth0`'s `getSession()` without changing the return type
 * or any caller. `connection()` marks this as request-time rather than
 * prerendered, since a real session lookup always is.
 */
export async function getSession(): Promise<AuthSession | null> {
  await connection();
  return {
    user: DEMO_USER,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  };
}

export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("No authenticated session");
  }
  return session;
}

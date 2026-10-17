import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection, NextResponse } from "next/server";
import { auth0, SESSION_ABSOLUTE_DURATION_SECONDS } from "@/lib/auth0";
import type { AuthSession } from "./types";
import { DEMO_USER } from "./demo-user";
import { isDemoAuthMode } from "./config";
import { toAuthUser } from "./map-user";
import { loginHref } from "./routes";

/**
 * Server-side session lookup, backed by the Auth0 SDK's encrypted session
 * cookie. Falls back to DEMO_USER only in demo mode (no Auth0 credentials,
 * non-production; see config.ts). `connection()` keeps this request-time.
 *
 * Use this — never a client-supplied id — to decide whose data to read/write.
 */
// cache(): one session read per request, however many layouts, pages and
// repositories ask for it.
export const getSession = cache(async function getSession(): Promise<AuthSession | null> {
  await connection();

  if (isDemoAuthMode()) {
    return {
      user: DEMO_USER,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      source: "demo",
    };
  }

  const session = await auth0.getSession();
  const user = toAuthUser(session?.user);
  if (!session || !user) return null;

  const createdAt = session.internal?.createdAt ?? Math.floor(Date.now() / 1000);
  return {
    user,
    expiresAt: new Date((createdAt + SESSION_ABSOLUTE_DURATION_SECONDS) * 1000).toISOString(),
    source: "auth0",
  };
});

/** The verified user's id (Auth0 `sub`) for scoping data. Redirects to login when signed out. */
export async function requireOwnerId(): Promise<string> {
  const session = await requireSession();
  return session.user.id;
}

/**
 * For Server Components and Server Actions: returns the session or sends
 * the visitor to Universal Login, coming back to `returnTo` afterwards.
 */
export async function requireSession(returnTo?: string): Promise<AuthSession> {
  const session = await getSession();
  if (!session) {
    redirect(loginHref({ returnTo }));
  }
  return session;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "unauthorized", message: "Sign in to access this resource." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

type SessionHandler<TContext> = (
  request: Request,
  context: TContext & { session: AuthSession },
) => Response | Promise<Response>;

/**
 * Wraps a Route Handler so it only runs with a verified session, which it
 * receives as `context.session`. Responds 401 JSON otherwise.
 *
 *   export const GET = withSession(async (_req, { session }) =>
 *     Response.json(await listTransactions(session.user.id)),
 *   );
 */
export function withSession<TContext = object>(handler: SessionHandler<TContext>) {
  return async (request: Request, context: TContext): Promise<Response> => {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    return handler(request, { ...context, session });
  };
}

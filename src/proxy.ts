import { NextResponse, type NextRequest } from "next/server";

import { auth0 } from "@/lib/auth0";
import { isAuth0Configured, isDemoAuthMode } from "@/lib/auth/config";
import {
  AUTH_ERROR_PATH,
  AUTH_ROUTES,
  DEFAULT_SIGNED_IN_PATH,
  isApiPath,
  isPublicPath,
  loginHref,
} from "@/lib/auth/routes";

/**
 * Network boundary (Next.js 16 `proxy.ts`, formerly `middleware.ts`).
 *
 * 1. Mounts the Auth0 SDK routes (/auth/login, /auth/callback, /auth/logout,
 *    /auth/profile, /auth/access-token) and rolls the session cookie.
 * 2. Optimistic route protection (default-deny, see PUBLIC_PATHS):
 *    signed-out page requests go to Universal Login, API requests get 401.
 *
 * This is a fast first gate, not the authorization layer. Pages and Route
 * Handlers must still read the user through src/lib/auth/server.ts.
 *
 * Add non-auth proxy behavior below the auth handling and keep returning
 * `authResponse` (or copy its cookies) so rolling sessions keep working.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isDemoAuthMode()) {
    // No Auth0 credentials (dev only): everyone is DEMO_USER, nothing is gated,
    // and the auth routes just bounce back into the app.
    if (pathname.startsWith("/auth/")) {
      return NextResponse.redirect(new URL(DEFAULT_SIGNED_IN_PATH, request.url));
    }
    return NextResponse.next();
  }

  if (!isAuth0Configured()) {
    // Production deploy without Auth0 env vars: fail closed, but visibly.
    console.error("[auth] Auth0 is not configured; set AUTH0_* env vars (see docs/AUTH0_SETUP.md).");
    if (isPublicPath(pathname) && !pathname.startsWith("/auth/")) return NextResponse.next();
    if (isApiPath(pathname)) {
      return NextResponse.json(
        { error: "auth_unavailable", message: "Sign-in is not available right now." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.redirect(new URL(`${AUTH_ERROR_PATH}?code=configuration`, request.url));
  }

  const authResponse = await auth0.middleware(request);

  if (pathname.startsWith("/auth/")) {
    return friendlyAuthFailure(request, authResponse) ?? authResponse;
  }

  if (isPublicPath(pathname)) {
    return authResponse;
  }

  const session = await auth0.getSession(request);
  if (session) {
    return authResponse;
  }

  if (isApiPath(pathname)) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in to access this resource." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.redirect(new URL(loginHref({ returnTo: `${pathname}${search}` }), request.url));
}

/**
 * The SDK answers login/logout failures (e.g. Auth0 unreachable or
 * misconfigured) with a plain-text 500. Send people somewhere recoverable,
 * keeping any Set-Cookie headers (logout has already cleared the session).
 */
function friendlyAuthFailure(request: NextRequest, authResponse: Response): NextResponse | null {
  if (authResponse.status < 500) return null;

  const { pathname } = request.nextUrl;
  let target: URL;
  if (pathname === AUTH_ROUTES.login) {
    target = new URL(`${AUTH_ERROR_PATH}?code=unavailable`, request.url);
  } else if (pathname === AUTH_ROUTES.logout) {
    target = new URL("/", request.url);
  } else {
    return null;
  }

  console.error(`[auth] ${pathname} failed with status ${authResponse.status}`);
  const response = NextResponse.redirect(target);
  for (const cookie of authResponse.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static metadata/assets.
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif|woff2?)$).*)",
  ],
};

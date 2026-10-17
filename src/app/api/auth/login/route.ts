import { NextRequest, NextResponse } from "next/server";

/**
 * Stub login endpoint. Demo mode has no real sign-in, so this just
 * redirects back to the app. Replace the body with the Auth0 SDK's
 * `handleLogin` (see src/lib/auth/README.md) — the route path and
 * the `loginHref` callers already match the SDK's convention.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/overview", request.url));
}

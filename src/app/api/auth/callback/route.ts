import { NextRequest, NextResponse } from "next/server";

/**
 * Stub OAuth callback. Replace with the Auth0 SDK's `handleCallback`
 * (see src/lib/auth/README.md). Not reachable in demo mode since
 * /api/auth/login never redirects to a real identity provider yet.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/overview", request.url));
}

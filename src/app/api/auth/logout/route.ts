import { NextRequest, NextResponse } from "next/server";

/**
 * Stub logout endpoint. Replace with the Auth0 SDK's `handleLogout`
 * (see src/lib/auth/README.md) once real sessions exist.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/overview", request.url));
}

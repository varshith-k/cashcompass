import { NextResponse } from "next/server";
import { withSession } from "@/lib/auth/session";

/**
 * Returns the current session as JSON. Signed-out requests get 401 (from
 * src/proxy.ts, and again from withSession).
 */
export const GET = withSession<RouteContext<"/api/auth/me">>(async (_request, { session }) => {
  return NextResponse.json({ session }, { headers: { "Cache-Control": "private, no-store" } });
});

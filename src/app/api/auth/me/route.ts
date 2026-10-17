import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * Returns the current session as JSON. Backed by the demo session today;
 * once src/lib/auth/session.ts calls into Auth0, this endpoint needs no
 * changes.
 */
export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session });
}

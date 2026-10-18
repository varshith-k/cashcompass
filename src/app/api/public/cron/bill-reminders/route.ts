import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runBillReminders } from "@/lib/finance/reminder-job";

/**
 * POST /api/public/cron/bill-reminders — sends due bill reminder emails.
 * Called hourly by the server's scheduler with `Authorization: Bearer
 * $CRON_SECRET`. Public in routing (no user session), so the secret is the
 * only permission; without CRON_SECRET set the endpoint stays disabled.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Reminders are disabled: CRON_SECRET is not set." }, { status: 503 });

  const provided = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runBillReminders();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

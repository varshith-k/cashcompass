import { NextResponse } from "next/server";
import { claimPhoneScan, completePhoneScan } from "@/lib/bill-scan/phone-sessions";
import { scanPhoto } from "@/lib/bill-scan/scan-photo";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/**
 * POST /api/public/scan/:token — the phone uploads one bill photo for the
 * laptop session that created the token. No sign-in: the unguessable,
 * single-use, 10-minute token is the only permission, and it can only fill
 * in the laptop's open form (nothing is saved to the account here).
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_PATTERN.test(token) || !claimPhoneScan(token)) {
    return NextResponse.json({ ok: false, message: "This scan link has expired or was already used. Start a new one on your laptop." }, { status: 410 });
  }

  let photo: FormDataEntryValue | null = null;
  try {
    photo = (await request.formData()).get("photo");
  } catch {
    // fall through: scanPhoto reports "No photo received."
  }

  const result = await scanPhoto(photo);
  completePhoneScan(token, result);
  return NextResponse.json(
    result.ok ? { ok: true, message: "Sent to your laptop. Check the details there and save." } : { ok: false, message: result.message },
    { status: result.ok ? 200 : 422, headers: { "Cache-Control": "no-store" } },
  );
}

"use server";

import { requireSession } from "@/lib/auth/session";
import { createPhoneScanSession, readPhoneScanSession, type PhoneScanStatus } from "./phone-sessions";
import { scanPhoto, type ScanBillResult } from "./scan-photo";

export type { ScanBillResult } from "./scan-photo";

export async function scanBillImage(formData: FormData): Promise<ScanBillResult> {
  // Spends the Gemini API key, so only signed-in users may call it.
  await requireSession();
  return scanPhoto(formData.get("photo"));
}

/** Laptop: starts a one-time "scan with your phone" session (QR code token). */
export async function startPhoneScan(): Promise<{ token: string; expiresAt: number }> {
  const { user } = await requireSession();
  return createPhoneScanSession(user.id);
}

/** Laptop: polls for the phone's photo result. Only the session's owner can read it. */
export async function checkPhoneScan(token: string): Promise<{ status: PhoneScanStatus; result?: ScanBillResult }> {
  const { user } = await requireSession();
  if (typeof token !== "string" || token.length > 64) return { status: "expired" };
  return readPhoneScanSession(token, user.id);
}

"use server";

import { networkInterfaces } from "node:os";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { createPhoneScanSession, readPhoneScanSession, type PhoneScanStatus } from "./phone-sessions";
import { scanPhoto, type ScanBillResult, type ScanKind } from "./scan-photo";

export type { ScanBillResult } from "./scan-photo";

export async function scanBillImage(formData: FormData): Promise<ScanBillResult> {
  // Spends the Gemini API key, so only signed-in users may call it.
  await requireSession();
  return scanPhoto(formData.get("photo"), formData.get("kind") === "receipt" ? "receipt" : "bill");
}

/**
 * In development the laptop is usually on localhost, which a phone can't
 * open. Return this machine's private Wi-Fi address instead, so the QR code
 * works while the laptop stays signed in on localhost (the phone page needs
 * no sign-in). Never used in production, where the site's own origin is right.
 */
async function devPhoneOrigin(): Promise<string | undefined> {
  if (process.env.NODE_ENV === "production") return undefined;
  const host = (await headers()).get("host") ?? "";
  const [hostname, port = "3000"] = host.split(":");
  if (!["localhost", "127.0.0.1"].includes(hostname)) return undefined;
  const candidates = Object.values(networkInterfaces())
    .flat()
    .filter((address) => address?.family === "IPv4" && !address.internal)
    .map((address) => address!.address);
  // Prefer home/office Wi-Fi ranges. 172.16–31.x is often a virtual adapter
  // (WSL, Hyper-V, Docker) that a phone can't reach, so it comes last.
  const preferred = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./];
  for (const pattern of preferred) {
    const match = candidates.find((ip) => pattern.test(ip));
    if (match) return `http://${match}:${port}`;
  }
  return undefined;
}

/** Laptop: starts a one-time "scan with your phone" session (QR code token). */
export async function startPhoneScan(kind: ScanKind = "bill"): Promise<{ token: string; expiresAt: number; phoneOrigin?: string }> {
  const { user } = await requireSession();
  return { ...createPhoneScanSession(user.id, kind === "receipt" ? "receipt" : "bill"), phoneOrigin: await devPhoneOrigin() };
}

/** Laptop: polls for the phone's photo result. Only the session's owner can read it. */
export async function checkPhoneScan(token: string): Promise<{ status: PhoneScanStatus; result?: ScanBillResult }> {
  const { user } = await requireSession();
  if (typeof token !== "string" || token.length > 64) return { status: "expired" };
  return readPhoneScanSession(token, user.id);
}

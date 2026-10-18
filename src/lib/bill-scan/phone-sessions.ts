import "server-only";
import { randomBytes } from "node:crypto";
import type { ScanBillResult, ScanKind } from "./scan-photo";

/**
 * "Scan with your phone" sessions. The laptop (signed in) starts one and
 * shows a QR code with an unguessable one-time token; the phone uses that
 * token to upload one photo without signing in. The token can only fill in
 * the laptop's open bill form: nothing is saved to the account until the
 * user confirms on the laptop.
 *
 * In-memory, so it assumes the single long-running server CashCompass is
 * deployed on (Vultr). Sessions expire after 10 minutes.
 */
export const PHONE_SCAN_TTL_MS = 10 * 60 * 1000;
const MAX_SESSIONS = 1000;

export type PhoneScanStatus = "waiting" | "processing" | "done" | "failed" | "expired";

interface PhoneScanSession {
  ownerId: string;
  kind: ScanKind;
  createdAt: number;
  status: Exclude<PhoneScanStatus, "expired">;
  result?: ScanBillResult;
}

// Kept on globalThis: Next.js bundles route handlers (the phone's upload) and
// server actions/pages (the laptop) separately, so a plain module-level Map
// would be a different, empty copy in each and the phone's token would never
// be found. One process-wide Map is shared by both.
const globalStore = globalThis as typeof globalThis & { __cashcompassPhoneScans?: Map<string, PhoneScanSession> };
const sessions = (globalStore.__cashcompassPhoneScans ??= new Map<string, PhoneScanSession>());

function sweep(now = Date.now()) {
  for (const [token, session] of sessions) {
    if (now - session.createdAt > PHONE_SCAN_TTL_MS) sessions.delete(token);
  }
}

export function createPhoneScanSession(ownerId: string, kind: ScanKind = "bill"): { token: string; expiresAt: number } {
  sweep();
  // One open session per user is enough; starting again replaces the old one.
  for (const [token, session] of sessions) if (session.ownerId === ownerId) sessions.delete(token);
  if (sessions.size >= MAX_SESSIONS) throw new Error("Too many scan sessions; try again shortly");
  const token = randomBytes(24).toString("base64url");
  const createdAt = Date.now();
  sessions.set(token, { ownerId, kind, createdAt, status: "waiting" });
  return { token, expiresAt: createdAt + PHONE_SCAN_TTL_MS };
}

/** Laptop side: only the user who started the session can read it. */
export function readPhoneScanSession(token: string, ownerId: string): { status: PhoneScanStatus; result?: ScanBillResult } {
  sweep();
  const session = sessions.get(token);
  if (!session || session.ownerId !== ownerId) return { status: "expired" };
  if (session.status === "done" || session.status === "failed") sessions.delete(token); // delivered once
  return { status: session.status, result: session.result };
}

/** Phone side: true if the token can still accept a photo. */
export function isPhoneScanOpen(token: string): boolean {
  sweep();
  return sessions.get(token)?.status === "waiting";
}

/** Phone side: whether the open session is for a bill or a receipt. */
export function phoneScanKind(token: string): ScanKind | null {
  sweep();
  const session = sessions.get(token);
  return session?.status === "waiting" ? session.kind : null;
}

/** Phone side: claims the session for one upload. Returns its kind, or null if it's expired or already used. */
export function claimPhoneScan(token: string): ScanKind | null {
  sweep();
  const session = sessions.get(token);
  if (!session || session.status !== "waiting") return null;
  session.status = "processing";
  return session.kind;
}

export function completePhoneScan(token: string, result: ScanBillResult) {
  const session = sessions.get(token);
  if (!session) return;
  session.status = result.ok ? "done" : "failed";
  session.result = result;
}

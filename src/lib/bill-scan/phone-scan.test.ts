import { afterEach, describe, expect, it, vi } from "vitest";

const scan = vi.hoisted(() => ({ result: { ok: true, fields: { counterparty: "Duke Energy", amount: 118.3 } } as { ok: boolean; fields?: object; message?: string } }));
vi.mock("./scan-photo", () => ({ scanPhoto: vi.fn(async () => scan.result) }));

import { POST } from "@/app/api/public/scan/[token]/route";
import { isPublicPath } from "@/lib/auth/routes";
import { scaledSize } from "./compress-image";
import { claimPhoneScan, createPhoneScanSession, isPhoneScanOpen, PHONE_SCAN_TTL_MS, readPhoneScanSession } from "./phone-sessions";

afterEach(() => vi.useRealTimers());

function upload(token: string) {
  const body = new FormData();
  body.set("photo", new File(["x"], "bill.jpg", { type: "image/jpeg" }));
  return POST(new Request(`http://localhost/api/public/scan/${token}`, { method: "POST", body }), { params: Promise.resolve({ token }) });
}

describe("phone scan sessions", () => {
  it("issues an unguessable token that accepts exactly one photo", () => {
    const { token } = createPhoneScanSession("auth0|laptop");
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(isPhoneScanOpen(token)).toBe(true);
    expect(claimPhoneScan(token)).toBe("bill");
    expect(claimPhoneScan(token)).toBeNull();
  });

  it("only lets the user who started it read the result", () => {
    const { token } = createPhoneScanSession("auth0|owner");
    expect(readPhoneScanSession(token, "auth0|someone-else").status).toBe("expired");
    expect(readPhoneScanSession(token, "auth0|owner").status).toBe("waiting");
  });

  it("expires after 10 minutes", () => {
    vi.useFakeTimers();
    const { token } = createPhoneScanSession("auth0|slow");
    vi.advanceTimersByTime(PHONE_SCAN_TTL_MS + 1);
    expect(isPhoneScanOpen(token)).toBe(false);
    expect(readPhoneScanSession(token, "auth0|slow").status).toBe("expired");
  });

  it("replaces an older session when the same user starts a new one", () => {
    const first = createPhoneScanSession("auth0|again").token;
    const second = createPhoneScanSession("auth0|again").token;
    expect(isPhoneScanOpen(first)).toBe(false);
    expect(isPhoneScanOpen(second)).toBe(true);
  });
});

describe("POST /api/public/scan/:token", () => {
  it("reads the photo, delivers the fields to the laptop once, and refuses reuse", async () => {
    const { token } = createPhoneScanSession("auth0|flow");
    const response = await upload(token);
    expect(response.status).toBe(200);

    const delivered = readPhoneScanSession(token, "auth0|flow");
    expect(delivered).toMatchObject({ status: "done", result: { ok: true, fields: { counterparty: "Duke Energy" } } });
    expect(readPhoneScanSession(token, "auth0|flow").status).toBe("expired");
    expect((await upload(token)).status).toBe(410);
  });

  it("rejects malformed or unknown tokens", async () => {
    expect((await upload("short")).status).toBe(410);
    expect((await upload("A".repeat(32))).status).toBe(410);
  });

  it("reports an unreadable photo to both the phone and the laptop", async () => {
    scan.result = { ok: false, message: "Couldn't read that photo clearly" };
    const { token } = createPhoneScanSession("auth0|blurry");
    expect((await upload(token)).status).toBe(422);
    expect(readPhoneScanSession(token, "auth0|blurry")).toMatchObject({ status: "failed", result: { ok: false } });
  });
});

describe("phone scan routing and resizing", () => {
  it("keeps /scan/ pages public while the app stays protected", () => {
    expect(isPublicPath("/scan/abc")).toBe(true);
    expect(isPublicPath("/bills")).toBe(false);
  });

  it("shrinks large photos to 1600px on the long edge and leaves small ones alone", () => {
    expect(scaledSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

import "server-only";
import { extractBillFromImage, type ExtractedBill, type ScanKind } from "./extract";

export type { ScanKind } from "./extract";

export interface ScanBillResult {
  ok: boolean;
  fields?: ExtractedBill;
  message?: string;
}

export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Validates a bill photo and reads it with Gemini. Shared by the in-app
 * upload (signed-in) and the phone upload (one-time scan token); callers
 * do their own authorization first.
 */
export async function scanPhoto(file: FormDataEntryValue | null, kind: ScanKind = "bill"): Promise<ScanBillResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "No photo received." };
  }
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES) {
    return { ok: false, message: "Use a JPEG, PNG, or WebP photo under 5 MB, or enter the details manually." };
  }
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, message: "Add GEMINI_API_KEY to scan bills automatically. Fill in the form manually for now." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fields = await extractBillFromImage(buffer.toString("base64"), file.type || "image/jpeg", kind);

  if (!fields) {
    return { ok: false, message: "Couldn't read that photo clearly. Fill in the form manually." };
  }
  return { ok: true, fields };
}

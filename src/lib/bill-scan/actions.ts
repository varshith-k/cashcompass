"use server";

import { extractBillFromImage, type ExtractedBill } from "./extract";

export interface ScanBillResult {
  ok: boolean;
  fields?: ExtractedBill;
  message?: string;
}

export async function scanBillImage(formData: FormData): Promise<ScanBillResult> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "No photo received." };
  }
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, message: "Add GEMINI_API_KEY to scan bills automatically — fill in the form manually for now." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fields = await extractBillFromImage(buffer.toString("base64"), file.type || "image/jpeg");

  if (!fields) {
    return { ok: false, message: "Couldn't read that photo clearly — fill in the form manually." };
  }
  return { ok: true, fields };
}

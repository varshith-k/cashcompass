/**
 * Client-side: shrinks a camera photo to a JPEG before upload. Phone
 * cameras produce 3–12 MB images (and HEIC on iPhones), which the scan
 * endpoint rejects above 5 MB; a 1600 px JPEG is plenty for Gemini to read
 * a bill and uploads quickly on mobile data.
 *
 * Returns the original file if the browser can't decode or re-encode it,
 * so the server can still accept or reject it as before.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.85;

export function scaledSize(width: number, height: number, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function compressImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    // imageOrientation "from-image" applies the camera's EXIF rotation.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) return file;
    // Keep the original if it was already a small JPEG and re-encoding didn't help.
    if (file.type === "image/jpeg" && blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

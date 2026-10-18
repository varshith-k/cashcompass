"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Loader2, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanBillImage, type ScanBillResult } from "@/lib/bill-scan/actions";
import { compressImage } from "@/lib/bill-scan/compress-image";
import type { ExtractedBill } from "@/lib/bill-scan/extract";
import { PhoneScanPanel } from "./phone-scan-panel";
import { WebcamCaptureDialog } from "./webcam-capture-dialog";

/**
 * Photo capture for bills and receipts: "Take photo", "Upload photo", and on
 * larger screens "Use my phone" (QR code). Calls onFields with whatever
 * Gemini could read; the user always reviews before saving.
 *
 * "Take photo" differs by device: on a touch-primary device (phone/tablet)
 * it opens the native camera app via <input capture>, which works well
 * there. On a mouse/trackpad-primary device (laptop/desktop) that attribute
 * is ignored by the browser and silently falls back to a file picker
 * indistinguishable from "Upload photo" - so there it opens a live webcam
 * capture dialog instead (webcam-capture-dialog.tsx).
 */
function isTouchPrimaryDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}
export function ScanPhotoControls({
  kind,
  onFields,
  onScanningChange,
}: {
  kind: "bill" | "receipt";
  onFields: (fields: ExtractedBill) => void;
  onScanningChange?: (scanning: boolean) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phoneScan, setPhoneScan] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Free the preview's object URL when it changes or the controls unmount.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function setBusy(next: boolean) {
    setScanning(next);
    onScanningChange?.(next);
  }

  function apply(result: ScanBillResult) {
    if (!result.ok) {
      setMessage(result.message ?? "Couldn't read that photo. Fill in the form manually.");
      return;
    }
    onFields(result.fields!);
    setMessage("Pulled these fields from the photo. Double-check before saving.");
  }

  async function handlePhoto(original: File) {
    setBusy(true);
    setMessage(null);
    try {
      // Camera photos are large (and HEIC on iPhones): shrink to a JPEG first.
      const file = await compressImage(original);
      setPreview(URL.createObjectURL(file));
      const data = new FormData();
      data.set("photo", file);
      data.set("kind", kind);
      apply(await scanBillImage(data));
    } catch {
      setMessage("Unable to scan the photo. Try again or enter the details manually.");
    } finally {
      setBusy(false);
    }
  }

  const fileInput = (ref: React.RefObject<HTMLInputElement | null>, camera: boolean) => (
    <input
      ref={ref}
      type="file"
      accept={camera ? "image/*" : "image/jpeg,image/png,image/webp"}
      {...(camera ? { capture: "environment" as const } : {})}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handlePhoto(file);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className="space-y-3">
      {fileInput(fileInputRef, false)}
      {fileInput(cameraInputRef, true)}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          className="min-h-11"
          disabled={scanning}
          onClick={() => (isTouchPrimaryDevice() ? cameraInputRef.current?.click() : setWebcamOpen(true))}
        >
          {scanning ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {scanning ? "Reading…" : "Take photo"}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={scanning} onClick={() => fileInputRef.current?.click()}>
          <ImageUp className="size-4" />
          Upload photo
        </Button>
      </div>
      <Button type="button" variant="ghost" className="hidden sm:flex w-full" disabled={scanning || phoneScan} onClick={() => setPhoneScan(true)}>
        <Smartphone className="size-4" />
        Use my phone to take the photo
      </Button>
      {phoneScan && (
        <PhoneScanPanel
          kind={kind}
          onClose={() => setPhoneScan(false)}
          onResult={(result) => {
            setPhoneScan(false);
            apply(result);
          }}
        />
      )}
      <WebcamCaptureDialog open={webcamOpen} onOpenChange={setWebcamOpen} onCapture={handlePhoto} kind={kind} />
      <p className="text-xs text-muted-foreground">
        Snap or upload a {kind} and CashCompass fills in the details for you to check.
      </p>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={`${kind} photo being read`} className="max-h-40 w-full rounded-lg border border-border object-contain bg-muted" />
      )}
      {message && (
        <p role="status" className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 mt-0.5 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}

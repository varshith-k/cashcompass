"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/bill-scan/compress-image";

type UploadState = { status: "idle" | "uploading" | "done" | "error"; message?: string };

/** Phone side of "scan with your phone": take or pick one photo and send it to the laptop session. */
export function PhoneScanUploader({ token }: { token: string }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [preview, setPreview] = useState<string | null>(null);

  async function upload(original: File) {
    setState({ status: "uploading" });
    try {
      const file = await compressImage(original);
      setPreview(URL.createObjectURL(file));
      const body = new FormData();
      body.set("photo", file);
      const response = await fetch(`/api/public/scan/${encodeURIComponent(token)}`, { method: "POST", body });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setState(json.ok ? { status: "done", message: json.message } : { status: "error", message: json.message ?? "Couldn't send the photo." });
    } catch {
      setState({ status: "error", message: "Couldn't reach CashCompass. Check your connection and try again." });
    }
  }

  const input = (ref: React.RefObject<HTMLInputElement | null>, camera: boolean) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      {...(camera ? { capture: "environment" as const } : {})}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) upload(file);
        e.target.value = "";
      }}
    />
  );

  if (state.status === "done") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="size-12 text-positive" aria-hidden="true" />
        <p className="font-heading text-lg font-semibold">Sent to your laptop</p>
        <p className="text-sm text-muted-foreground">{state.message} You can close this page.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="Bill photo sent" className="max-h-48 rounded-lg border border-border object-contain" />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {input(cameraRef, true)}
      {input(pickerRef, false)}
      <Button className="w-full min-h-14 text-base" disabled={state.status === "uploading"} onClick={() => cameraRef.current?.click()}>
        {state.status === "uploading" ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        {state.status === "uploading" ? "Reading your bill…" : "Take photo of bill"}
      </Button>
      <Button variant="outline" className="w-full min-h-12" disabled={state.status === "uploading"} onClick={() => pickerRef.current?.click()}>
        <ImageUp className="size-4" />
        Choose from photos
      </Button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && state.status === "uploading" && <img src={preview} alt="Bill photo being sent" className="max-h-48 w-full rounded-lg border border-border object-contain" />}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-critical">
          {state.message}
        </p>
      )}
    </div>
  );
}

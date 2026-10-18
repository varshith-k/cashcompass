"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Laptop/desktop side of "Take photo": a live webcam preview captured with
 * getUserMedia, not the <input capture> hint - browsers without a touch
 * primary pointer ignore that hint and silently fall back to a file picker,
 * which looks identical to "Upload photo" and defeats the point of the
 * button. Phones still use the native camera app (scan-photo-controls.tsx),
 * where <input capture> actually works and is the better experience.
 */
export function WebcamCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  kind: "bill" | "receipt";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Resets state left over from a previous open (error/ready) before
    // starting the camera sync below; the initial open already defaults
    // to "starting", so this only matters on re-open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("starting");
    setErrorMessage(null);

    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Camera access was denied. Allow camera access for this site, or use Upload photo instead."
            : "Couldn't access a camera. Use Upload photo instead.",
        );
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  function capture() {
    const video = videoRef.current;
    if (!video || status !== "ready") return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], "webcam-capture.jpg", { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) streamRef.current?.getTracks().forEach((track) => track.stop());
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
          <DialogDescription>Center the {kind} in frame, then capture.</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              <span className="sr-only">Starting camera…</span>
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white">
              <CircleAlert className="size-6" aria-hidden="true" />
              <p role="alert" className="text-sm">{errorMessage}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={capture} disabled={status !== "ready"}>
            <Camera className="size-4" />
            Capture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

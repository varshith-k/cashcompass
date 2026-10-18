"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Loader2, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkPhoneScan, startPhoneScan, type ScanBillResult } from "@/lib/bill-scan/actions";

const POLL_MS = 2000;

/**
 * Laptop side of "scan with your phone": shows a QR code for a one-time
 * link, then polls until the phone's photo has been read and hands the
 * result back to the bill form.
 */
export function PhoneScanPanel({ onResult, onClose }: { onResult: (result: ScanBillResult) => void; onClose: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [status, setStatus] = useState<"starting" | "waiting" | "processing" | "expired" | "error">("starting");
  const resultHandler = useRef(onResult);
  useEffect(() => {
    resultHandler.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function start() {
      try {
        const { token, expiresAt } = await startPhoneScan();
        if (cancelled) return;
        const url = `${window.location.origin}/scan/${token}`;
        setLink(url);
        setQrSvg(await QRCode.toString(url, { type: "svg", margin: 1, width: 192, errorCorrectionLevel: "M" }));
        setStatus("waiting");

        const poll = async () => {
          if (cancelled) return;
          if (Date.now() > expiresAt) return setStatus("expired");
          try {
            const { status: next, result } = await checkPhoneScan(token);
            if (cancelled) return;
            if ((next === "done" || next === "failed") && result) return resultHandler.current(result);
            if (next === "expired") return setStatus("expired");
            setStatus(next === "processing" ? "processing" : "waiting");
          } catch {
            // transient network error: keep polling
          }
          timer = setTimeout(poll, POLL_MS);
        };
        timer = setTimeout(poll, POLL_MS);
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    start();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const onLocalhost = typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

  return (
    <div className="rounded-xl border border-border bg-accent/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Smartphone className="size-4" aria-hidden="true" />
          Scan with your phone
        </p>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel phone scan" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>

      {status === "starting" && <p className="text-sm text-muted-foreground">Creating a scan link…</p>}
      {status === "error" && <p role="alert" className="text-sm text-critical">Couldn&apos;t create a scan link. Try again.</p>}
      {status === "expired" && <p role="alert" className="text-sm text-muted-foreground">This link expired. Close this and choose Use my phone again.</p>}

      {(status === "waiting" || status === "processing") && link && (
        <>
          <div className="flex flex-col items-center gap-2">
            {qrSvg && (
              <div
                role="img"
                aria-label="QR code that opens the phone scan page"
                className="rounded-lg bg-white p-2 [&_svg]:size-44"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            )}
            <p className="text-center text-xs text-muted-foreground">Point your phone camera at the code, then take a photo of the bill.</p>
          </div>
          <div className="flex gap-2">
            <input readOnly value={link} aria-label="Phone scan link" className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 font-mono text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(link)}>
              Copy
            </Button>
          </div>
          <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {status === "processing" ? "Photo received, reading the bill…" : "Waiting for your phone… (link works once, for 10 minutes)"}
          </p>
          {onLocalhost && (
            <p className="text-xs text-caution">
              You&apos;re on localhost, which your phone can&apos;t open. Open this app on your laptop using the &quot;Network&quot; address that{" "}
              <code>npm run dev</code> prints (e.g. http://192.168.x.x:3000), or use the live site.
            </p>
          )}
        </>
      )}
    </div>
  );
}

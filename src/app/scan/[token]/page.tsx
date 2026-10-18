import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { PhoneScanUploader } from "@/components/bills/phone-scan-uploader";
import { phoneScanKind } from "@/lib/bill-scan/phone-sessions";

export const metadata: Metadata = {
  title: "Scan a bill · CashCompass",
  robots: { index: false },
};

/**
 * Opened on the phone from the laptop's QR code. Public (no sign-in): the
 * one-time token in the URL is the only permission, and it can only send
 * one photo to the laptop's open bill form.
 */
export default async function PhoneScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const kind = /^[A-Za-z0-9_-]{32}$/.test(token) ? phoneScanKind(token) : null;
  const open = kind !== null;
  const noun = kind === "receipt" ? "receipt" : "bill";

  return (
    <main className="flex min-h-dvh flex-col bg-background px-5 py-8">
      <div className="mx-auto w-full max-w-sm flex-1 space-y-6">
        <div className="flex items-center gap-2 text-brand-navy dark:text-foreground">
          <Compass className="size-6" strokeWidth={1.75} aria-hidden="true" />
          <span className="font-heading text-lg font-semibold">CashCompass</span>
        </div>
        {open ? (
          <>
            <div>
              <h1 className="font-heading text-2xl font-bold">Scan a {noun}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Take a clear photo of the {noun}. It goes straight to the form open on your laptop, where you check it and save.
              </p>
            </div>
            <PhoneScanUploader token={token} noun={noun} />
            <p className="text-xs text-muted-foreground">This link works once and expires 10 minutes after it was created.</p>
          </>
        ) : (
          <div role="alert">
            <h1 className="font-heading text-2xl font-bold">This scan link has expired</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Scan links work once and only for 10 minutes. On your laptop, open Add bill → Use my phone to get a new QR code.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

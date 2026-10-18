"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setupNessieAccount } from "@/lib/nessie/actions";

/** Run after an authenticated app visit, never during an RSC render/prefetch. */
export function NessieAccountSetup() {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState("Preparing your own sandbox checking account…");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Strict Mode replays the effect in development. Server locking also
    // protects concurrent tabs/processes and persists uncertain POST attempts.
    if (started.current) return;
    started.current = true;
    void setupNessieAccount().then((result) => {
      setMessage(result.message);
      setFailed(!result.ok);
      if (result.ok) router.refresh();
    }).catch(() => {
      setMessage("Your sandbox account could not be prepared. You can retry in Settings.");
      setFailed(true);
    });
  }, [router]);

  return <div role="status" className="mb-4 rounded-xl border border-border bg-card p-3 text-sm">
    {message} {failed && <Link href="/settings" className="font-medium underline underline-offset-4">Open Settings</Link>}
  </div>;
}

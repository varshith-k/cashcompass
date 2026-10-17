"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { syncNessie } from "@/lib/nessie/actions";
import type { SyncStatus } from "@/lib/nessie/status";

export function NessieCard({
  isConfigured,
  initialStatus,
}: {
  isConfigured: boolean;
  initialStatus: SyncStatus | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSync() {
    setPending(true);
    setMessage(null);
    try {
      const result = await syncNessie();
      if (result.ok) {
        setStatus({ timestamp: new Date().toISOString(), added: result.added, skipped: result.skipped });
      } else {
        setMessage(result.message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Capital One Nessie demo data</CardTitle>
        <Badge
          variant="outline"
          className={isConfigured ? "border-positive/40 text-positive" : "border-border text-muted-foreground"}
        >
          {isConfigured ? (
            <>
              <CheckCircle2 className="size-3" /> Connected
            </>
          ) : (
            <>
              <XCircle className="size-3" /> Not connected
            </>
          )}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Simulated banking records from Capital One&rsquo;s Nessie sandbox — not a real connected
          bank account, and no real credentials are ever requested.
        </p>

        {status && (
          <p className="text-xs text-muted-foreground">
            Last synced {new Date(status.timestamp).toLocaleString()} — {status.added} added, {status.skipped} already up to date.
          </p>
        )}
        {message && <p className="text-xs text-caution">{message}</p>}

        <Button type="button" variant="outline" size="sm" onClick={handleSync} disabled={pending}>
          <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
          {pending ? "Syncing…" : "Sync Nessie data"}
        </Button>
      </CardContent>
    </Card>
  );
}

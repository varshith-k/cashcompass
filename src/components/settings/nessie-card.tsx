"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { syncNessie } from "@/lib/nessie/actions";
import { formatCurrency } from "@/lib/format";
import type { NessieAccount } from "@/lib/nessie/client";
import type { SyncStatus } from "@/lib/nessie/status";

export function NessieCard({
  isConfigured,
  initialStatus,
  accounts,
  accountError,
}: {
  isConfigured: boolean;
  initialStatus: SyncStatus | null;
  accounts: NessieAccount[];
  accountError?: string;
}) {
  const [accountId, setAccountId] = useState(initialStatus?.accountId ?? accounts[0]?._id ?? "");
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSync() {
    setPending(true);
    setMessage(null);
    try {
      const result = await syncNessie(accountId);
      if (result.ok) {
        setStatus({ ...result, timestamp: new Date().toISOString() });
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("Unable to synchronize. Try again when the connection is available.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap gap-2 items-center justify-between">
        <CardTitle>Capital One Nessie demo data</CardTitle>
        <Badge
          variant="outline"
          className={isConfigured ? "border-positive/40 text-positive" : "border-border text-muted-foreground"}
        >
          {isConfigured ? (
            <>
              <CheckCircle2 className="size-3" /> Configured
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

        {accounts.length > 0 && <div className="space-y-1.5">
          <label htmlFor="nessie-account" className="text-sm font-medium">Demo account</label>
          <select id="nessie-account" className="w-full rounded-lg border border-border bg-card p-2 text-sm" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={pending}>
            {accounts.map((account) => <option key={account._id} value={account._id}>{account.nickname} · {account.type} · {formatCurrency(account.balance, { cents: true })}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Sandbox balances are shown for reference. The forecast uses its disclosed demo opening balance and imported events.</p>
        </div>}
        {accountError && <p role="alert" className="text-xs text-caution">{accountError}</p>}
        {status && (
          <p className="text-xs text-muted-foreground">
            Last synced {new Date(status.timestamp).toLocaleString()} — {status.added} added, {status.updated ?? 0} updated, {status.skipped} already up to date.
          </p>
        )}
        {message && <p role="status" className="text-xs text-caution">{message}</p>}

        <Button type="button" variant="outline" size="sm" onClick={handleSync} disabled={pending}>
          <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
          {pending ? "Syncing…" : "Sync Nessie data"}
        </Button>
      </CardContent>
    </Card>
  );
}

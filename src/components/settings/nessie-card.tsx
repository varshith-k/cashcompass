"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setupNessieAccount, syncNessie } from "@/lib/nessie/actions";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import type { NessieAccount } from "@/lib/nessie/client";
import type { SyncStatus } from "@/lib/nessie/status";

export function NessieCard({
  isConfigured,
  initialStatus,
  accounts,
  accountError,
  canSetup,
}: {
  isConfigured: boolean;
  initialStatus: SyncStatus | null;
  accounts: NessieAccount[];
  accountError?: string;
  canSetup: boolean;
}) {
  const router = useRouter();
  const [selectedId, setAccountId] = useState("");
  const accountId = accounts.some((account) => account._id === selectedId) ? selectedId : accounts[0]?._id ?? "";
  const [lastSync, setStatus] = useState(initialStatus);
  const status = lastSync?.accountId === accountId ? lastSync : null;
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSetup() {
    setPending(true);
    setMessage(null);
    try {
      const result = await setupNessieAccount();
      setMessage(result.message);
      if (result.ok) router.refresh();
    } catch { setMessage("Unable to prepare your account. Please retry."); }
    finally { setPending(false); }
  }

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
      <CardHeader className="flex flex-row flex-wrap gap-3 items-center justify-between">
        <CardTitle>Capital One Nessie</CardTitle>
        <Badge
          variant="outline"
          className={accounts.length ? "border-positive/40 text-positive" : "border-border text-muted-foreground"}
        >
          {accounts.length ? (
            <>
              <CheckCircle2 className="size-3" /> Your sandbox account
            </>
          ) : (
            <>
              <XCircle className="size-3" /> {isConfigured ? "Setup needed" : "Not connected"}
            </>
          )}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Connect simulated banking records for your demo. This sandbox account contains no real money or real bank credentials.
        </p>

        {accounts.length > 0 && <div className="grid min-w-0 gap-3">
          <label htmlFor="nessie-account" className="text-sm font-medium">Your sandbox checking account</label>
          <select id="nessie-account" className="h-11 w-full min-w-0 max-w-full rounded-lg border border-border bg-card px-3 text-sm" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={pending}>
            {accounts.map((account) => <option key={account._id} value={account._id}>{account.nickname} · {account.type} · {formatCurrency(account.balance, { cents: true })}</option>)}
          </select>
          <p className="text-xs leading-5 text-muted-foreground">Sync uses the sandbox balance and avoids counting imported activity twice.</p>
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium">Account ID</p>
            <p className="break-all font-mono text-xs leading-5 text-muted-foreground">{accountId}</p>
            <p className="text-xs leading-5 text-muted-foreground">Share this ID with a friend for sandbox P2P transfers.</p>
          </div>
        </div>}
        {accountError && <p role="alert" className="text-xs text-caution">{accountError}</p>}
        {message && <p role="status" className="text-xs text-caution">{message}</p>}

        <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {status && (
            <div className="space-y-1 text-xs leading-5 text-muted-foreground">
              <p>Last synced {new Date(status.timestamp).toLocaleString()}</p>
              <p>{status.added} added · {status.updated ?? 0} updated · {status.skipped} up to date</p>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {accounts.length === 0 && canSetup && <Button type="button" variant="outline" className="min-h-11 whitespace-normal" onClick={handleSetup} disabled={pending}>
              {pending ? "Preparing…" : "Set up / recover my sandbox account"}
            </Button>}
            <Button type="button" variant="outline" className="min-h-11" onClick={handleSync} disabled={pending || !accountId}>
              <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
              {pending ? "Syncing…" : "Sync Nessie data"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

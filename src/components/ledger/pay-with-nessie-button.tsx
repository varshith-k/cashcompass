"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { payWithNessieTransfer, type TransferResult } from "@/lib/finance/settle-up-actions";

/** Two-step (confirm) Capital One Nessie P2P transfer that settles a balance you owe. */
export function PayWithNessieButton({ entryId, friendName, amount }: { entryId: string; friendName: string; amount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TransferResult | null>(null);

  if (result?.ok) {
    return <p role="status" className="text-xs text-positive shrink-0">{result.message}</p>;
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      {confirming ? (
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  setResult(await payWithNessieTransfer(entryId));
                } catch {
                  setResult({ ok: false, message: "Couldn't send the transfer. Try again." });
                }
                setConfirming(false);
              })
            }
          >
            {pending ? "Sending…" : `Send ${formatCurrency(amount, { cents: true })}`}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => { setResult(null); setConfirming(true); }}>
          <ArrowRightLeft className="size-3.5" />
          Pay with Nessie
        </Button>
      )}
      {confirming && !pending && (
        <p className="text-xs text-muted-foreground">Nessie sandbox transfer to {friendName}. No real money moves.</p>
      )}
      {result && !result.ok && <p role="alert" className="text-xs text-critical">{result.message}</p>}
    </div>
  );
}

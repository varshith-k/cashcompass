"use client";

import { useState, useTransition } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptSharedBalance, declineSharedBalance } from "@/lib/finance/shared-actions";
import { formatCurrency, formatRelativeDay } from "@/lib/format";

export interface IncomingShare {
  id: string;
  fromName: string;
  fromEmail?: string;
  youOwe: boolean;
  amount: number;
  description: string;
  dueDate: string;
}

/** Balances other CashCompass users recorded with you, waiting for you to accept or decline. */
export function SharedWithYou({ shares }: { shares: IncomingShare[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startTransition] = useTransition();

  if (shares.length === 0 && !message) return null;

  function answer(id: string, accept: boolean) {
    setPendingId(id);
    startTransition(async () => {
      const result = accept ? await acceptSharedBalance(id) : await declineSharedBalance(id);
      setMessage({ ok: result.ok, text: result.message });
      setPendingId(null);
    });
  }

  return (
    <Card className="border-interactive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="size-4" aria-hidden="true" />
          Shared with you
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {shares.length > 0 && (
          <ul className="divide-y divide-border">
            {shares.map((share) => (
              <li key={share.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="flex-1 min-w-48">
                  <p className="text-sm">
                    <span className="font-medium">{share.fromName}</span>{" "}
                    {share.youOwe ? "says you owe them" : "says they owe you"}{" "}
                    <span className="font-medium tabular-nums">{formatCurrency(share.amount, { cents: true })}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[share.description, `Due ${formatRelativeDay(share.dueDate)}`, share.fromEmail].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={pendingId !== null} onClick={() => answer(share.id, true)}>
                    {pendingId === share.id ? "Saving…" : "Accept"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={pendingId !== null} onClick={() => answer(share.id, false)}>
                    Not mine
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Accepting adds it to your Settle Up, linked to theirs: a payment either of you logs updates both.
        </p>
        {message && (
          <p role="status" aria-live="polite" className={message.ok ? "text-sm text-positive" : "text-sm text-critical"}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

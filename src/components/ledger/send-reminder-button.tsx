"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NotifyResult } from "@/lib/email/notify-friend";
import { sendSettleUpReminder } from "@/lib/finance/settle-up-actions";

/** Emails the friend a reminder; falls back to the user's own mail app when email isn't set up. */
export function SendReminderButton({ entryId, friendName }: { entryId: string; friendName: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<NotifyResult | { status: "error" } | null>(null);

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              setResult(await sendSettleUpReminder(entryId));
            } catch {
              setResult({ status: "error" });
            }
          })
        }
      >
        <Mail className="size-3.5" />
        {pending ? "Sending…" : "Email reminder"}
      </Button>
      {result && <ReminderStatus result={result} friendName={friendName} />}
    </div>
  );
}

export function ReminderStatus({ result, friendName }: { result: NotifyResult | { status: "error" }; friendName: string }) {
  const text = "text-xs";
  switch (result.status) {
    case "sent":
      return <p role="status" className={`${text} text-positive`}>Emailed {friendName} at {result.to}.</p>;
    case "rate-limited":
      return <p role="status" className={`${text} text-muted-foreground`}>Already reminded in the last 12 hours.</p>;
    case "no-email":
      return <p role="status" className={`${text} text-muted-foreground`}>Add an email for {friendName} to send reminders.</p>;
    case "not-configured":
    case "failed":
      return (
        <p role="status" className={`${text} text-muted-foreground`}>
          {result.status === "failed" ? "Couldn't send the email." : "Email sending isn't set up."}{" "}
          <a href={result.mailto} className="font-medium text-interactive underline">
            Open it in your mail app
          </a>
        </p>
      );
    default:
      return <p role="alert" className={`${text} text-critical`}>Couldn&apos;t send the reminder. Try again.</p>;
  }
}

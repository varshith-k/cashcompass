"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { NotifyResult } from "@/lib/email/notify-friend";
import { createLedgerEntry } from "@/lib/finance/actions";
import type { EventDirection } from "@/lib/finance/types";
import { ReminderStatus } from "./send-reminder-button";

export interface FriendOption {
  id: string;
  name: string;
  hasEmail: boolean;
}

const SOMEONE_ELSE = "";

export function AddLedgerEntrySheet({ friends = [] }: { friends?: FriendOption[] }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<EventDirection>("income");
  const [friendId, setFriendId] = useState<string>(friends[0]?.id ?? SOMEONE_ELSE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [emailResult, setEmailResult] = useState<NotifyResult | null>(null);
  const [typedEmail, setTypedEmail] = useState("");
  const [typedName, setTypedName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const friend = friends.find((f) => f.id === friendId);

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setEmailResult(null);
      setTypedEmail("");
      setTypedName("");
    }
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Add balance
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{emailResult ? "Balance added" : "Add a balance"}</SheetTitle>
        </SheetHeader>

        {emailResult ? (
          <div className="px-4 pb-6 space-y-4">
            <ReminderStatus result={emailResult} friendName={friend?.name ?? (typedName.trim() || "your friend")} />
            <Button className="w-full" onClick={() => close(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form
            ref={formRef}
            action={async (formData) => {
              setPending(true);
              setError(false);
              try {
                const result = await createLedgerEntry(formData);
                formRef.current?.reset();
                if (result) setEmailResult(result);
                else close(false);
              } catch {
                setError(true);
              } finally {
                setPending(false);
              }
            }}
            className="flex-1 overflow-y-auto px-4 pb-6 space-y-4"
          >
            <input type="hidden" name="direction" value={direction} />

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={direction === "income" ? "default" : "outline"} onClick={() => setDirection("income")}>
                They owe me
              </Button>
              <Button type="button" variant={direction === "expense" ? "default" : "outline"} onClick={() => setDirection("expense")}>
                I owe them
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="friendId">Friend</Label>
              <select
                id="friendId"
                name="friendId"
                value={friendId}
                onChange={(e) => setFriendId(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {friends.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
                <option value={SOMEONE_ELSE}>Someone else (not in my friends)</option>
              </select>
            </div>

            {!friend && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="counterparty">Who</Label>
                  <Input id="counterparty" name="counterparty" required maxLength={60} placeholder="Sam" value={typedName} onChange={(e) => setTypedName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Their email (optional)</Label>
                  <Input id="email" name="email" type="email" maxLength={254} autoComplete="off" placeholder="sam@example.com" value={typedEmail} onChange={(e) => setTypedEmail(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Lets CashCompass email them. They&apos;ll be saved to your friends so reminders work later.</p>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">{direction === "income" ? "Expected by" : "Pay by"}</Label>
                <Input id="date" name="date" type="date" required />
              </div>
            </div>

            {(friend?.hasEmail || (!friend && typedEmail.includes("@"))) && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="notify" defaultChecked className="size-4 accent-[var(--interactive)]" />
                Email {friend?.name ?? (typedName.trim() || "them")} about this
              </label>
            )}

            {error && <p role="alert" className="text-sm text-critical">Unable to save. Check the details and try again.</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Adding…" : "Add balance"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

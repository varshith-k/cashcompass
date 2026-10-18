"use client";

import { useActionState, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { addFriendAction, type FriendFormState } from "@/lib/finance/settle-up-actions";

const INITIAL: FriendFormState = { status: "idle", message: "" };

export function AddFriendSheet() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (previous: FriendFormState, data: FormData) => {
    const next = await addFriendAction(previous, data);
    if (next.status === "saved") {
      formRef.current?.reset();
      setOpen(false);
    }
    return next;
  }, INITIAL);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm" variant="outline">
            <UserPlus className="size-4" />
            Add friend
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a friend</SheetTitle>
        </SheetHeader>
        <form ref={formRef} action={formAction} className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="friend-name">Name</Label>
            <Input id="friend-name" name="name" required maxLength={60} autoComplete="off" placeholder="Sam" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="friend-email">Email (optional)</Label>
            <Input id="friend-email" name="email" type="email" maxLength={254} autoComplete="off" placeholder="sam@example.com" />
            <p className="text-xs text-muted-foreground">
              Lets CashCompass email them when you add a balance, send a reminder, or settle up.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="friend-phone">Phone (optional)</Label>
            <Input id="friend-phone" name="phone" type="tel" autoComplete="off" placeholder="+1 555 123 4567" />
            <p className="text-xs text-muted-foreground">For one-tap WhatsApp reminders.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="friend-nessie">Capital One Nessie account ID (optional)</Label>
            <Input id="friend-nessie" name="nessieAccountId" autoComplete="off" maxLength={36} placeholder="Sandbox account ID (UUID or 24 characters)" className="font-mono" />
            <p className="text-xs text-muted-foreground">Lets you settle up with a Nessie peer-to-peer transfer (sandbox, no real money).</p>
          </div>
          {state.status === "error" && (
            <p role="alert" className="text-sm text-critical">
              {state.message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Adding…" : "Add friend"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

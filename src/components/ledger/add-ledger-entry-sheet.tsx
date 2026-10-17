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
import { createLedgerEntry } from "@/lib/finance/actions";
import type { EventDirection } from "@/lib/finance/types";

export function AddLedgerEntrySheet() {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<EventDirection>("income");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Add entry
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add money owed or lent</SheetTitle>
        </SheetHeader>
        <form
          ref={formRef}
          action={async (formData) => {
            setPending(true);
            try {
              await createLedgerEntry(formData);
              formRef.current?.reset();
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-4"
        >
          <input type="hidden" name="direction" value={direction} />

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={direction === "income" ? "default" : "outline"}
              onClick={() => setDirection("income")}
            >
              Owed to me
            </Button>
            <Button
              type="button"
              variant={direction === "expense" ? "default" : "outline"}
              onClick={() => setDirection("expense")}
            >
              I owe
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="counterparty">Who</Label>
            <Input id="counterparty" name="counterparty" required placeholder="Sam" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Expected date</Label>
              <Input id="date" name="date" type="date" required />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Adding…" : "Add entry"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

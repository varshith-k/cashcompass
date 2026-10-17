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
import { createWishlistGoal } from "@/lib/finance/actions";

export function AddGoalSheet() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Add goal
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a wishlist goal</SheetTitle>
        </SheetHeader>
        <form
          ref={formRef}
          action={async (formData) => {
            setPending(true);
            try {
              await createWishlistGoal(formData);
              formRef.current?.reset();
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">What do you want?</Label>
            <Input id="name" name="name" required placeholder="New MacBook" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="targetAmount">Price</Label>
              <Input id="targetAmount" name="targetAmount" type="number" step="0.01" min="1" required placeholder="1200" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetDate">Target date</Label>
              <Input id="targetDate" name="targetDate" type="date" required />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Adding…" : "Add goal"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

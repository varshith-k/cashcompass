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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBill } from "@/lib/finance/actions";
import { EXPENSE_CATEGORIES } from "@/lib/finance/categories";

export function AddBillSheet() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [recurring, setRecurring] = useState(true);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Add bill
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add bill</SheetTitle>
        </SheetHeader>
        <form
          ref={formRef}
          action={async (formData) => {
            setPending(true);
            try {
              await createBill(formData);
              formRef.current?.reset();
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="counterparty">Biller</Label>
            <Input id="counterparty" name="counterparty" required placeholder="Duke Energy" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Due date</Label>
              <Input id="date" name="date" type="date" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select
              name="category"
              value={category}
              onValueChange={(value) => setCategory(value ?? EXPENSE_CATEGORIES[0])}
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="recurring">Recurring</Label>
              <p className="text-xs text-muted-foreground">Repeats monthly</p>
            </div>
            <Switch id="recurring" name="recurring" checked={recurring} onCheckedChange={setRecurring} />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Adding…" : "Add bill"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

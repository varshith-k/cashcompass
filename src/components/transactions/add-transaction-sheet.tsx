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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTransaction } from "@/lib/finance/actions";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/finance/categories";
import type { EventDirection } from "@/lib/finance/types";

export function AddTransactionSheet() {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<EventDirection>("expense");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const categories = direction === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function handleDirectionChange(next: EventDirection) {
    setDirection(next);
    setCategory(next === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Add transaction
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add transaction</SheetTitle>
        </SheetHeader>
        <form
          ref={formRef}
          action={async (formData) => {
            setPending(true);
            try {
              await createTransaction(formData);
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
              variant={direction === "expense" ? "default" : "outline"}
              onClick={() => handleDirectionChange("expense")}
            >
              Expense
            </Button>
            <Button
              type="button"
              variant={direction === "income" ? "default" : "outline"}
              onClick={() => handleDirectionChange("income")}
            >
              Income
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="counterparty">Merchant / counterparty</Label>
            <Input id="counterparty" name="counterparty" required placeholder="Trader Joe's" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select
              name="category"
              value={category}
              onValueChange={(value) => setCategory(value ?? categories[0])}
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Adding…" : "Add transaction"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

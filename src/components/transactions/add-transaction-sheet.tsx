"use client";

import { useId, useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
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
import { createTransaction, updateTransaction } from "@/lib/finance/actions";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/finance/categories";
import type { EventDirection, FinancialEvent } from "@/lib/finance/types";

export function AddTransactionSheet({ transaction }: { transaction?: FinancialEvent } = {}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<EventDirection>(transaction?.direction ?? "expense");
  const [category, setCategory] = useState<string>(transaction?.category ?? EXPENSE_CATEGORIES[0]);
  const [recurring, setRecurring] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const categories = direction === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function handleDirectionChange(next: EventDirection) {
    setDirection(next);
    setCategory(next === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
    if (next === "expense") setRecurring(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size={transaction ? "icon-sm" : "sm"} variant={transaction ? "ghost" : "default"} aria-label={transaction ? `Edit transaction with ${transaction.counterparty}` : undefined}>
            {transaction ? <Pencil className="size-3.5" /> : <Plus className="size-4" />}
            {!transaction && "Add transaction"}
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{transaction ? "Edit transaction" : "Add transaction"}</SheetTitle>
        </SheetHeader>
        <form
          ref={formRef}
          action={async (formData) => {
            setPending(true);
            setError(null);
            try {
              await (transaction ? updateTransaction : createTransaction)(formData);
              formRef.current?.reset();
              setOpen(false);
            } catch {
              setError("Unable to save the transaction. Check the fields and try again.");
            } finally {
              setPending(false);
            }
          }}
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-4"
        >
          {transaction && <input type="hidden" name="id" value={transaction.id} />}
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
            <Label htmlFor={`${formId}-counterparty`}>Merchant / counterparty</Label>
            <Input id={`${formId}-counterparty`} name="counterparty" required defaultValue={transaction?.counterparty} placeholder="Trader Joe's" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-amount`}>Amount</Label>
              <Input id={`${formId}-amount`} name="amount" type="number" step="0.01" min="0.01" required defaultValue={transaction?.amount} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-date`}>Date</Label>
              <Input
                id={`${formId}-date`}
                name="date"
                type="date"
                required
                defaultValue={(transaction?.date ?? new Date().toISOString()).slice(0, 10)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-category`}>Category</Label>
            <Select
              name="category"
              value={category}
              onValueChange={(value) => setCategory(value ?? categories[0])}
            >
              <SelectTrigger id={`${formId}-category`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Set([category, ...categories])).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!transaction && direction === "income" && (
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <Label htmlFor={`${formId}-recurring`}>Recurring</Label>
                <p className="text-xs text-muted-foreground">
                  Hasn&rsquo;t happened yet — repeats monthly and sets your next payday
                </p>
              </div>
              <Switch id={`${formId}-recurring`} name="recurring" checked={recurring} onCheckedChange={setRecurring} />
            </div>
          )}

          {error && <p role="alert" className="text-sm text-critical">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : transaction ? "Save changes" : "Add transaction"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

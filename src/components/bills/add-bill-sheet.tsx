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
import { ScanPhotoControls } from "./scan-photo-controls";

/** Upcoming bills (still to pay). Paid purchases go in Receipts instead. */
export function AddBillSheet() {
  const [open, setOpen] = useState(false);
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [recurring, setRecurring] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const isCard = category === "Credit card";

  function resetForm() {
    setCounterparty("");
    setAmount("");
    setMinimumPayment("");
    setDate("");
    setCategory(EXPENSE_CATEGORIES[0]);
    setRecurring(true);
    setSaveError(null);
    setFormKey((key) => key + 1); // remounts the scan controls (clears preview/message)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
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
            setSaveError(null);
            try {
              await createBill(formData);
              formRef.current?.reset();
              resetForm();
              setOpen(false);
            } catch {
              setSaveError(
                isCard
                  ? "Unable to save. Check the amounts: the minimum payment can't be more than the statement balance."
                  : "Unable to save the bill. Check the fields and try again.",
              );
            } finally {
              setPending(false);
            }
          }}
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-4"
        >
          <ScanPhotoControls
            key={formKey}
            kind="bill"
            onScanningChange={setScanning}
            onFields={(fields) => {
              if (fields.counterparty) setCounterparty(fields.counterparty);
              if (fields.amount) setAmount(String(fields.amount));
              if (fields.date) setDate(fields.date);
              if (fields.category) setCategory(fields.category);
              if (fields.minimumPayment) setMinimumPayment(String(fields.minimumPayment));
            }}
          />

          <div className="space-y-1.5">
            <Label htmlFor="counterparty">{isCard ? "Card" : "Biller"}</Label>
            <Input
              id="counterparty"
              name="counterparty"
              required
              placeholder={isCard ? "Chase Sapphire" : "Duke Energy"}
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select name="category" value={category} onValueChange={(value) => setCategory(value ?? EXPENSE_CATEGORIES[0])}>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">{isCard ? "Statement balance" : "Amount"}</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Due date</Label>
              <Input id="date" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {isCard && (
            <div className="space-y-1.5">
              <Label htmlFor="minimumPayment">Minimum payment (optional)</Label>
              <Input
                id="minimumPayment"
                name="minimumPayment"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={minimumPayment}
                onChange={(e) => setMinimumPayment(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your forecast plans for the full statement balance. The minimum is shown on the bill so you can compare.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="recurring">Recurring</Label>
              <p className="text-xs text-muted-foreground">Repeats monthly</p>
            </div>
            <Switch id="recurring" name="recurring" checked={recurring} onCheckedChange={setRecurring} />
          </div>

          {saveError && <p role="alert" className="text-sm text-critical">{saveError}</p>}
          <Button type="submit" className="w-full" disabled={pending || scanning}>
            {pending ? "Adding…" : "Add bill"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

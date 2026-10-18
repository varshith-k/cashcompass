"use client";

import { useRef, useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { createReceipt } from "@/lib/finance/actions";
import { EXPENSE_CATEGORIES } from "@/lib/finance/categories";
import { ScanPhotoControls } from "./scan-photo-controls";

const RECEIPT_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => !["Housing", "Utilities", "Credit card", "Savings"].includes(c));

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Logs an already-paid purchase (restaurant, shop, cab…) from a receipt, with optional notes. */
export function AddReceiptSheet() {
  const [open, setOpen] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState("Dining");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    setMerchant("");
    setAmount("");
    setDate(today());
    setCategory("Dining");
    setNotes("");
    setError(false);
    setFormKey((key) => key + 1);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <SheetTrigger
        render={
          <Button size="sm">
            <Receipt className="size-4" />
            Add receipt
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add receipt</SheetTitle>
        </SheetHeader>
        <form
          ref={formRef}
          action={async (data) => {
            setPending(true);
            setError(false);
            try {
              await createReceipt(data);
              formRef.current?.reset();
              reset();
              setOpen(false);
            } catch {
              setError(true);
            } finally {
              setPending(false);
            }
          }}
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-4"
        >
          <ScanPhotoControls
            key={formKey}
            kind="receipt"
            onScanningChange={setScanning}
            onFields={(fields) => {
              if (fields.counterparty) setMerchant(fields.counterparty);
              if (fields.amount) setAmount(String(fields.amount));
              if (fields.date) setDate(fields.date);
              if (fields.category && RECEIPT_CATEGORIES.includes(fields.category as (typeof RECEIPT_CATEGORIES)[number])) setCategory(fields.category);
            }}
          />

          <div className="space-y-1.5">
            <Label htmlFor="receipt-merchant">Paid to</Label>
            <Input id="receipt-merchant" name="counterparty" required maxLength={80} placeholder="Barbeque Nation" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="receipt-amount">Amount paid</Label>
              <Input id="receipt-amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-date">Date</Label>
              <Input id="receipt-date" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt-category">Category</Label>
            <select
              id="receipt-category"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {RECEIPT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt-notes">Notes (optional)</Label>
            <textarea
              id="receipt-notes"
              name="notes"
              rows={3}
              maxLength={500}
              placeholder="Team lunch, split with Sam"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {error && <p role="alert" className="text-sm text-critical">Unable to save the receipt. Check the fields and try again.</p>}
          <Button type="submit" className="w-full" disabled={pending || scanning}>
            {pending ? "Saving…" : "Save receipt"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

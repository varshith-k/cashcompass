"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, Plus, Smartphone, Sparkles } from "lucide-react";
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
import { scanBillImage, type ScanBillResult } from "@/lib/bill-scan/actions";
import { PhoneScanPanel } from "./phone-scan-panel";
import { compressImage } from "@/lib/bill-scan/compress-image";
import { EXPENSE_CATEGORIES } from "@/lib/finance/categories";

export function AddBillSheet() {
  const [open, setOpen] = useState(false);
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [recurring, setRecurring] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phoneScan, setPhoneScan] = useState(false);
  // Opens the phone's rear camera directly (capture="environment"); on desktop it falls back to a file picker.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setCounterparty("");
    setAmount("");
    setDate("");
    setCategory(EXPENSE_CATEGORIES[0]);
    setRecurring(true);
    setScanMessage(null);
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setPhoneScan(false);
  }

  // Fills the form from a scan result (direct upload or the phone).
  function applyScanResult(result: ScanBillResult) {
    if (!result.ok) {
      setScanMessage(result.message ?? "Couldn't read that photo — fill in the form manually.");
      return;
    }
    const fields = result.fields!;
    if (fields.counterparty) setCounterparty(fields.counterparty);
    if (fields.amount) setAmount(String(fields.amount));
    if (fields.date) setDate(fields.date);
    if (fields.category) setCategory(fields.category);
    setScanMessage("Pulled these fields from the photo — double-check before saving.");
  }

  async function handlePhoto(original: File) {
    setScanning(true);
    setScanMessage(null);
    try {
      // Camera photos are large (and HEIC on iPhones): shrink to a JPEG first.
      const file = await compressImage(original);
      setPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(file);
      });
      const photoData = new FormData();
      photoData.set("photo", file);
      applyScanResult(await scanBillImage(photoData));
    } catch {
      setScanMessage("Unable to scan the photo. Try again or enter the details manually.");
    } finally {
      setScanning(false);
    }
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
              setSaveError("Unable to save the bill. Check the fields and try again.");
            } finally {
              setPending(false);
            }
          }}
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-4"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhoto(file);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhoto(file);
              e.target.value = "";
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={scanning}
              onClick={() => cameraInputRef.current?.click()}
            >
              {scanning ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              {scanning ? "Reading…" : "Take photo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={scanning}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageUp className="size-4" />
              Upload photo
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="hidden sm:flex w-full"
            disabled={scanning || phoneScan}
            onClick={() => setPhoneScan(true)}
          >
            <Smartphone className="size-4" />
            Use my phone to take the photo
          </Button>
          {phoneScan && (
            <PhoneScanPanel
              onClose={() => setPhoneScan(false)}
              onResult={(result) => {
                setPhoneScan(false);
                applyScanResult(result);
              }}
            />
          )}
          <p className="text-xs text-muted-foreground">Snap or upload a bill and CashCompass fills in the details for you to check.</p>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Bill photo being read" className="max-h-40 w-full rounded-lg border border-border object-contain bg-muted" />
          )}
          {scanMessage && (
            <p role="status" className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 mt-0.5 shrink-0" />
              {scanMessage}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="counterparty">Biller</Label>
            <Input
              id="counterparty"
              name="counterparty"
              required
              placeholder="Duke Energy"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
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
              <Input
                id="date"
                name="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
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

          {saveError && <p role="alert" className="text-sm text-critical">{saveError}</p>}
          <Button type="submit" className="w-full" disabled={pending || scanning}>
            {pending ? "Adding…" : "Add bill"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

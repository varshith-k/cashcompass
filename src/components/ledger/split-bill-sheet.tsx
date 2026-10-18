"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Sparkles, SplitSquareHorizontal, UserPlus, X } from "lucide-react";
import { ScanPhotoControls } from "@/components/bills/scan-photo-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EXPENSE_CATEGORIES } from "@/lib/finance/categories";
import { equalShares, ME, shareDifferenceCents, validateShares } from "@/lib/finance/split";
import { createSplit, suggestSplit, type CreateSplitResult } from "@/lib/finance/split-actions";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SplitReceiptOption {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  notes?: string;
  alreadySplit: boolean;
}

interface Person {
  key: string;
  kind: "me" | "friend" | "guest";
  friendId?: string;
  name: string;
  email?: string;
}

type Method = "equal" | "exact" | "describe";

const NEW = "new";
const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function isoDaysFromToday(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Splitwise-style: pick a receipt (or a new bill), pick people, split equally/exactly/by description, confirm. */
export function SplitBillSheet({
  receipts,
  friends,
  initialReceiptId,
}: {
  receipts: SplitReceiptOption[];
  friends: { id: string; name: string; hasEmail: boolean }[];
  initialReceiptId?: string;
}) {
  const openable = receipts.filter((r) => !r.alreadySplit);
  const initial = openable.find((r) => r.id === initialReceiptId);
  const [open, setOpen] = useState(Boolean(initial));
  const [source, setSource] = useState<string>(initial?.id ?? openable[0]?.id ?? NEW);
  const [merchant, setMerchant] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(isoDaysFromToday(0));
  const [category, setCategory] = useState("Dining");
  const [newNotes, setNewNotes] = useState("");
  const [includeMe, setIncludeMe] = useState(true);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [guests, setGuests] = useState<Person[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [method, setMethod] = useState<Method>("equal");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [description, setDescription] = useState(initial?.notes ?? openable[0]?.notes ?? "");
  const [suggestion, setSuggestion] = useState<{ explanation?: string; warning?: string; items: Record<string, string> } | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(isoDaysFromToday(7));
  const [notify, setNotify] = useState(true);
  const [result, setResult] = useState<CreateSplitResult | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const [saving, startSave] = useTransition();
  const [scanning, setScanning] = useState(false);

  const receipt = receipts.find((r) => r.id === source);
  const total = receipt ? receipt.amount : Number(newAmount) || 0;
  const billName = receipt ? receipt.merchant : merchant.trim() || "this bill";

  const people: Person[] = useMemo(
    () => [
      ...(includeMe ? [{ key: ME, kind: "me" as const, name: "You" }] : []),
      ...friends.filter((f) => friendIds.includes(f.id)).map((f) => ({ key: f.id, kind: "friend" as const, friendId: f.id, name: f.name })),
      ...guests,
    ],
    [includeMe, friends, friendIds, guests],
  );

  const even = equalShares(total, people.length);
  const shareFor = (person: Person, index: number) => (method === "equal" ? even[index] ?? 0 : Number(amounts[person.key]) || 0);
  const shares = people.map(shareFor);
  const problem = people.filter((p) => p.kind !== ME).length === 0 ? "Add at least one other person." : validateShares(total, shares);
  const allocated = total - shareDifferenceCents(total, shares) / 100;
  const anyEmail = people.some((p) => (p.kind === "friend" ? friends.find((f) => f.id === p.friendId)?.hasEmail : Boolean(p.email)));

  function pickSource(value: string) {
    setSource(value);
    setSuggestion(null);
    const r = receipts.find((x) => x.id === value);
    setDescription(r?.notes ?? "");
  }

  function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    setGuests((list) => [...list, { key: `guest-${Date.now()}`, kind: "guest", name, email: guestEmail.trim() || undefined }]);
    setGuestName("");
    setGuestEmail("");
  }

  function suggest() {
    setSuggestError(null);
    startSuggest(async () => {
      try {
        const res = await suggestSplit({ total, merchant: billName, people: people.map((p) => ({ key: p.key, name: p.name })), description });
        if (!res.ok) {
          setSuggestError(res.message);
          setAmounts(Object.fromEntries(people.map((p, i) => [p.key, (even[i] ?? 0).toFixed(2)])));
          return;
        }
        setAmounts(Object.fromEntries(people.map((p) => [p.key, (res.shares[p.key] ?? 0).toFixed(2)])));
        setSuggestion({ explanation: res.explanation, warning: res.warning, items: res.items });
      } catch {
        setSuggestError("Couldn't get a suggestion. Enter the amounts yourself.");
      }
    });
  }

  function confirm() {
    startSave(async () => {
      try {
        const res = await createSplit({
          receiptId: receipt?.id,
          newExpense: receipt ? undefined : { merchant: merchant.trim(), amount: total, date: newDate, category, notes: newNotes },
          participants: people.map((p, i) => ({ key: p.key, kind: p.kind, friendId: p.friendId, name: p.name, email: p.email, amount: shares[i]! })),
          dueDate,
          notify,
        });
        setResult(res);
      } catch {
        setResult({ ok: false, message: "Couldn't save the split. Try again." });
      }
    });
  }

  function reset(next: boolean) {
    setOpen(next);
    if (!next && result?.ok) {
      setResult(null);
      setFriendIds([]);
      setGuests([]);
      setAmounts({});
      setSuggestion(null);
      setMerchant("");
      setNewAmount("");
      setNewNotes("");
    }
  }

  return (
    <Sheet open={open} onOpenChange={reset}>
      <SheetTrigger
        render={
          <Button size="sm" variant="outline">
            <SplitSquareHorizontal className="size-4" />
            Split a bill
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{result?.ok ? "Split saved" : "Split a bill"}</SheetTitle>
        </SheetHeader>

        {result?.ok ? (
          <div className="px-4 pb-6 space-y-4">
            <p role="status" className="text-sm">{result.message}</p>
            <Button className="w-full" onClick={() => reset(false)}>Done</Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
            {/* 1. What */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">1. What are you splitting?</h3>
              <select aria-label="Bill to split" className={fieldClass} value={source} onChange={(e) => pickSource(e.target.value)}>
                {openable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.merchant} · {formatCurrency(r.amount, { cents: true })} · {r.date.slice(0, 10)}
                  </option>
                ))}
                <option value={NEW}>A new bill (enter or scan it)</option>
              </select>
              {receipt?.notes && <p className="text-xs text-muted-foreground">Notes: {receipt.notes}</p>}
              {!receipt && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <ScanPhotoControls
                    kind="receipt"
                    onScanningChange={setScanning}
                    onFields={(f) => {
                      if (f.counterparty) setMerchant(f.counterparty);
                      if (f.amount) setNewAmount(String(f.amount));
                      if (f.date) setNewDate(f.date);
                      if (f.category) setCategory(f.category);
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label htmlFor="split-merchant">Paid to</Label>
                      <Input id="split-merchant" value={merchant} maxLength={80} placeholder="Satchel's Pizza" onChange={(e) => setMerchant(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="split-total">Total you paid</Label>
                      <Input id="split-total" type="number" step="0.01" min="0.01" value={newAmount} placeholder="0.00" onChange={(e) => setNewAmount(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="split-date">Date</Label>
                      <Input id="split-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label htmlFor="split-category">Category</Label>
                      <select id="split-category" className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                        {EXPENSE_CATEGORIES.filter((c) => !["Housing", "Utilities", "Credit card", "Savings"].includes(c)).map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label htmlFor="split-notes">Notes (optional)</Label>
                      <Input id="split-notes" value={newNotes} maxLength={500} placeholder="Friday dinner" onChange={(e) => setNewNotes(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">You paid {formatCurrency(total, { cents: true })}. Each person&apos;s share becomes a balance they owe you.</p>
            </section>

            {/* 2. Who */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">2. Who&apos;s splitting?</h3>
              <div className="flex flex-wrap gap-2">
                <Chip active={includeMe} onClick={() => setIncludeMe((v) => !v)}>You</Chip>
                {friends.map((f) => (
                  <Chip key={f.id} active={friendIds.includes(f.id)} onClick={() => setFriendIds((ids) => (ids.includes(f.id) ? ids.filter((x) => x !== f.id) : [...ids, f.id]))}>
                    {f.name}
                  </Chip>
                ))}
                {guests.map((g) => (
                  <span key={g.key} className="inline-flex items-center gap-1 rounded-full bg-interactive px-3 py-1 text-xs text-white">
                    {g.name}
                    <button type="button" aria-label={`Remove ${g.name}`} onClick={() => setGuests((list) => list.filter((x) => x.key !== g.key))}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input aria-label="Someone else's name" placeholder="Someone else" value={guestName} maxLength={60} onChange={(e) => setGuestName(e.target.value)} />
                <Input aria-label="Their email (optional)" type="email" placeholder="email (optional)" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
                <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={addGuest} disabled={!guestName.trim()}>
                  <UserPlus className="size-4" />
                  Add
                </Button>
              </div>
            </section>

            {/* 3. How */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">3. How should it be split?</h3>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
                {(["equal", "exact", "describe"] as Method[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMethod(m);
                      if (m !== "equal" && Object.keys(amounts).length === 0) setAmounts(Object.fromEntries(people.map((p, i) => [p.key, (even[i] ?? 0).toFixed(2)])));
                    }}
                    className={cn("rounded-md py-1.5 text-sm font-medium", method === m ? "bg-interactive text-white" : "text-muted-foreground hover:text-foreground")}
                  >
                    {m === "equal" ? "Equally" : m === "exact" ? "Exact amounts" : "Describe it"}
                  </button>
                ))}
              </div>

              {method === "describe" && (
                <div className="space-y-2">
                  <Label htmlFor="split-description">Who had what?</Label>
                  <textarea
                    id="split-description"
                    rows={3}
                    maxLength={1500}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
                    placeholder="I had the pasta ($14), Sreeram had pizza ($16), we shared fries. Split tax and tip by what we ate."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <Button type="button" size="sm" disabled={suggesting || people.length < 2 || total <= 0} onClick={suggest}>
                    {suggesting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {suggesting ? "Working it out…" : "Suggest split"}
                  </Button>
                  {suggestError && <p role="alert" className="text-xs text-caution">{suggestError}</p>}
                  {suggestion?.explanation && <p className="text-xs text-muted-foreground">Gemini: {suggestion.explanation} Check the amounts below before confirming.</p>}
                  {suggestion?.warning && <p role="alert" className="text-xs text-caution">{suggestion.warning}</p>}
                </div>
              )}

              {people.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {people.map((p, i) => (
                    <li key={p.key} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{p.name}</p>
                        {suggestion?.items[p.key] && <p className="text-xs text-muted-foreground truncate">{suggestion.items[p.key]}</p>}
                      </div>
                      {method === "equal" ? (
                        <span className="text-sm tabular-nums">{formatCurrency(shares[i]!, { cents: true })}</span>
                      ) : (
                        <Input
                          aria-label={`${p.name}'s share`}
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 w-28 text-right tabular-nums"
                          value={amounts[p.key] ?? ""}
                          onChange={(e) => setAmounts((a) => ({ ...a, [p.key]: e.target.value }))}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className={cn("text-xs", problem ? "text-caution" : "text-positive")}>
                Allocated {formatCurrency(allocated, { cents: true })} of {formatCurrency(total, { cents: true })}
                {problem ? ` · ${problem}` : " ✓"}
              </p>
            </section>

            {/* 4. Confirm */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">4. Confirm</h3>
              <div className="flex items-center gap-3">
                <Label htmlFor="split-due" className="shrink-0">Pay me back by</Label>
                <Input id="split-due" type="date" className="h-9" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              {anyEmail && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-[var(--interactive)]" />
                  Email everyone their share
                </label>
              )}
              {result && !result.ok && <p role="alert" className="text-sm text-critical">{result.message}</p>}
              <Button className="w-full" disabled={Boolean(problem) || saving || scanning} onClick={confirm}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {saving ? "Saving…" : "Confirm split"}
              </Button>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors min-h-8",
        active ? "border-interactive bg-interactive text-white" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

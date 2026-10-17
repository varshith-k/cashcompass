"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
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
import { updateBudgetLimits } from "@/lib/finance/actions";
import type { BudgetAllocation } from "@/lib/finance/budgets";

export function EditBudgetsSheet({ budgets }: { budgets: BudgetAllocation[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm" variant="outline">
            <Pencil className="size-4" />
            Edit budgets
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit budgets</SheetTitle>
        </SheetHeader>
        <form
          action={async (formData) => {
            setPending(true);
            setError(false);
            try {
              await updateBudgetLimits(formData);
              setOpen(false);
            } catch {
              setError(true);
            } finally {
              setPending(false);
            }
          }}
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-4"
        >
          {budgets.map((budget) => (
            <div key={budget.category} className="space-y-1.5">
              <Label htmlFor={`limit_${budget.category}`}>{budget.category}</Label>
              <Input
                id={`limit_${budget.category}`}
                name={`limit_${budget.category}`}
                type="number"
                min="0"
                step="1"
                defaultValue={budget.monthlyLimit}
              />
            </div>
          ))}
          {error && <p role="alert" className="text-sm text-critical">Unable to save. Check the details and try again.</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save budgets"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

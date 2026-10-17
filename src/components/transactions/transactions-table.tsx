"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Receipt, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteTransaction } from "@/lib/finance/actions";
import { ALL_CATEGORIES } from "@/lib/finance/categories";
import type { EventDirection, FinancialEvent } from "@/lib/finance/types";
import { formatCurrency, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type DirectionFilter = "all" | EventDirection;

export function TransactionsTable({ transactions }: { transactions: FinancialEvent[] }) {
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (direction !== "all" && t.direction !== direction) return false;
      if (category !== "all" && t.category !== category) return false;
      if (query && !`${t.counterparty} ${t.category}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [transactions, search, direction, category]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search merchant or category…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search transactions"
          />
        </div>

        <div className="flex gap-1.5">
          {(["all", "income", "expense"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={direction === option ? "default" : "outline"}
              onClick={() => setDirection(option)}
              className="capitalize"
            >
              {option}
            </Button>
          ))}
        </div>

        <Select value={category} onValueChange={(value) => setCategory(value ?? "all")}>
          <SelectTrigger className="w-40" aria-label="Category">
            <SelectValue placeholder="Category">
              {(value: string | null) => (value === "all" || !value ? "All categories" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {ALL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-16 text-muted-foreground">
          <Receipt className="size-8" strokeWidth={1.5} />
          <p className="text-sm max-w-xs">
            {transactions.length === 0
              ? "No expenses yet. Add your first transaction to start understanding your spending."
              : "No transactions match your filters."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className={cn(
                  "rounded-full p-2 shrink-0",
                  t.direction === "income" ? "bg-positive/10 text-positive" : "bg-muted text-muted-foreground",
                )}
              >
                {t.direction === "income" ? (
                  <ArrowDownLeft className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.counterparty}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {t.category}
                  </Badge>
                  {t.source === "nessie" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-interactive/30 text-brand-navy">
                      Nessie
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{formatRelativeDay(t.date)}</span>
                </div>
              </div>
              <p
                className={cn(
                  "text-sm font-medium tabular-nums shrink-0",
                  t.direction === "income" ? "text-positive" : "text-foreground",
                )}
              >
                {t.direction === "income" ? "+" : "-"}
                {formatCurrency(t.amount, { cents: true })}
              </p>
              <form action={deleteTransaction}>
                <input type="hidden" name="id" value={t.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete transaction with ${t.counterparty}`}
                  className="text-muted-foreground hover:text-critical"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

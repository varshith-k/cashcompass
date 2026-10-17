"use client";

import { isValidElement, useId, useMemo, useState, cloneElement } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScenarioChart } from "./scenario-chart";
import {
  computeForecast,
  countBillsAtRisk,
  selectUpcomingBills,
  summarizeForecast,
} from "@/lib/finance/calculations";
import { buildPurchaseEvent, buildSavingsPlanEvents, buildShiftedEvent } from "@/lib/finance/scenarios";
import type { FinancialEvent } from "@/lib/finance/types";
import { formatCurrency, formatShortDate } from "@/lib/format";

type ScenarioKind = "buy-now" | "buy-after-payday" | "delay-bill" | "repayment-late" | "save-for-goal";

const SCENARIOS: { value: ScenarioKind; label: string }[] = [
  { value: "buy-now", label: "Buy now" },
  { value: "buy-after-payday", label: "Buy after payday" },
  { value: "delay-bill", label: "Delay a bill" },
  { value: "repayment-late", label: "Repayment arrives late" },
  { value: "save-for-goal", label: "Save for a goal" },
];

interface WhatIfSimulatorProps {
  events: FinancialEvent[];
  openingBalance: number;
  bufferThreshold: number;
  forecastDays: number;
  historyDays: number;
  nextPaydayDate: string | null;
  initialAmount?: string;
  initialLabel?: string;
}

export function WhatIfSimulator({
  events,
  openingBalance,
  bufferThreshold,
  forecastDays,
  historyDays,
  nextPaydayDate,
  initialAmount = "150",
  initialLabel = "",
}: WhatIfSimulatorProps) {
  const [kind, setKind] = useState<ScenarioKind>("buy-now");
  const [amount, setAmount] = useState(initialAmount);
  const [label, setLabel] = useState(initialLabel);
  const [delayDays, setDelayDays] = useState("7");
  const [selectedBillId, setSelectedBillId] = useState<string>("");
  const [selectedRepaymentId, setSelectedRepaymentId] = useState<string>("");
  const [weeklyAmount, setWeeklyAmount] = useState("50");
  const [weeks, setWeeks] = useState("8");

  const bills = useMemo(() => selectUpcomingBills(events), [events]);
  const repayments = useMemo(
    () => events.filter((e) => e.certainty === "uncertain" && e.record === "planned"),
    [events],
  );

  const startDate = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - historyDays);
    return d;
  }, [historyDays]);

  const todayIndex = historyDays;

  const baselinePoints = useMemo(
    () =>
      computeForecast(openingBalance, events, {
        days: forecastDays,
        lowBalanceThreshold: bufferThreshold,
        startDate: new Date(startDate),
      }),
    [openingBalance, events, startDate, forecastDays, bufferThreshold],
  );

  const { scenarioEvents, assumptions, suggestedAction } = useMemo(() => {
    const amt = Number.isFinite(Number(amount)) ? Math.min(9999999999.99, Math.max(0, Number(amount))) : 0;
    const weeklyAmt = Number.isFinite(Number(weeklyAmount)) ? Math.min(9999999999.99, Math.max(0, Number(weeklyAmount))) : 0;
    const weekCount = Math.min(52, Math.max(0, Math.trunc(Number(weeks) || 0)));
    const delay = Math.min(365, Math.max(0, Math.trunc(Number(delayDays) || 0)));

    switch (kind) {
      case "buy-now": {
        const purchase = buildPurchaseEvent({ amount: amt, label: label || "Purchase", date: new Date().toISOString() });
        return {
          scenarioEvents: events.concat(purchase),
          assumptions: [`Treats the ${formatCurrency(amt)} purchase as happening today.`],
          suggestedAction: "Compare the minimum balance below against buying after your next payday instead.",
        };
      }
      case "buy-after-payday": {
        if (!nextPaydayDate) return { scenarioEvents: events, assumptions: ["No scheduled payday is available."], suggestedAction: "Add a planned income event before comparing purchase dates." };
        const purchase = buildPurchaseEvent({ amount: amt, label: label || "Purchase", date: nextPaydayDate });
        return {
          scenarioEvents: events.concat(purchase),
          assumptions: [`Treats the ${formatCurrency(amt)} purchase as happening on your next payday (${formatShortDate(nextPaydayDate)}).`],
          suggestedAction: "If this clears your buffer more comfortably, waiting is the safer option.",
        };
      }
      case "delay-bill": {
        const original = bills.find((b) => b.id === selectedBillId);
        if (!original) return { scenarioEvents: events, assumptions: ["Pick a bill to delay."], suggestedAction: "" };
        const shifted = buildShiftedEvent(original, delay);
        return {
          scenarioEvents: events.filter((e) => e.id !== original.id).concat(shifted),
          assumptions: [`Pushes the ${original.counterparty} payment ${delay} day(s) later, to ${formatShortDate(shifted.date)}.`],
          suggestedAction: "Only delay a bill if the biller allows it — this doesn't contact them for you.",
        };
      }
      case "repayment-late": {
        const original = repayments.find((r) => r.id === selectedRepaymentId);
        if (!original) return { scenarioEvents: events, assumptions: ["Pick a repayment to delay."], suggestedAction: "" };
        const shifted = buildShiftedEvent(original, delay);
        return {
          scenarioEvents: events.filter((e) => e.id !== original.id).concat(shifted),
          assumptions: [`Assumes ${original.counterparty}'s repayment arrives ${delay} day(s) late, on ${formatShortDate(shifted.date)}.`],
          suggestedAction: "Uncertain repayments shouldn't be counted on to cover a bill due before they arrive.",
        };
      }
      case "save-for-goal": {
        const plan = buildSavingsPlanEvents({ weeklyAmount: weeklyAmt, weeks: weekCount, goalLabel: label || "Savings goal" });
        return {
          scenarioEvents: events.concat(plan),
          assumptions: [`Sets aside ${formatCurrency(weeklyAmt)} every week for ${weekCount} weeks.`],
          suggestedAction: "If this keeps you above your buffer the whole time, the schedule is affordable.",
        };
      }
    }
  }, [kind, amount, label, delayDays, selectedBillId, selectedRepaymentId, weeklyAmount, weeks, events, bills, repayments, nextPaydayDate]);

  const scenarioPoints = useMemo(
    () =>
      computeForecast(openingBalance, scenarioEvents, {
        days: forecastDays,
        lowBalanceThreshold: bufferThreshold,
        startDate: new Date(startDate),
      }),
    [openingBalance, scenarioEvents, startDate, forecastDays, bufferThreshold],
  );

  const baselineSummary = summarizeForecast(baselinePoints.slice(todayIndex));
  const conservativeMinimum = Math.min(...scenarioPoints.slice(todayIndex).map((point) => point.conservativeBalance));
  const scenarioSummary = summarizeForecast(scenarioPoints.slice(todayIndex));
  const baselineBillsAtRisk = countBillsAtRisk(bills, baselinePoints);
  const scenarioBillsAtRisk = countBillsAtRisk(selectUpcomingBills(scenarioEvents), scenarioPoints);
  const scenarioLabel = SCENARIOS.find((s) => s.value === kind)?.label ?? "Scenario";
  const getsWorse = scenarioSummary.minBalance < baselineSummary.minBalance - 0.01;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What-if simulator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">Demo forecast from a seeded opening balance. Monthly bills repeat; other income and expenses appear only on recorded dates. Unlisted daily spending is excluded; uncertain repayments may not arrive. Results cover the visible forecast only.</p>
        <div className="flex flex-wrap gap-1.5">
          {SCENARIOS.map((s) => (
            <Button
              key={s.value}
              type="button"
              size="sm"
              variant={kind === s.value ? "default" : "outline"}
              disabled={s.value === "buy-after-payday" && !nextPaydayDate}
              aria-pressed={kind === s.value}
              onClick={() => setKind(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {(kind === "buy-now" || kind === "buy-after-payday") && (
            <>
              <Field label="What are you buying?">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="MacBook" />
              </Field>
              <Field label="Amount">
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
            </>
          )}

          {kind === "delay-bill" && (
            <>
              <Field label="Bill">
                <Select value={selectedBillId} onValueChange={(v) => setSelectedBillId(v ?? "")}>
                  <SelectTrigger className="w-full" aria-label="Bill">
                    <SelectValue placeholder="Choose a bill">
                      {(value: string | null) => {
                        const bill = bills.find((b) => b.id === value);
                        return bill ? `${bill.counterparty} — ${formatCurrency(bill.amount)}` : "Choose a bill";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {bills.map((bill) => (
                      <SelectItem key={bill.id} value={bill.id}>
                        {bill.counterparty} — {formatCurrency(bill.amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Delay by (days)">
                <Input type="number" min="1" value={delayDays} onChange={(e) => setDelayDays(e.target.value)} />
              </Field>
            </>
          )}

          {kind === "repayment-late" && (
            <>
              <Field label="Repayment">
                <Select value={selectedRepaymentId} onValueChange={(v) => setSelectedRepaymentId(v ?? "")}>
                  <SelectTrigger className="w-full" aria-label="Repayment">
                    <SelectValue placeholder="Choose a repayment">
                      {(value: string | null) => {
                        const repayment = repayments.find((r) => r.id === value);
                        return repayment ? `${repayment.counterparty} — ${formatCurrency(repayment.amount)}` : "Choose a repayment";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {repayments.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.counterparty} — {formatCurrency(r.amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Late by (days)">
                <Input type="number" min="1" value={delayDays} onChange={(e) => setDelayDays(e.target.value)} />
              </Field>
            </>
          )}

          {kind === "save-for-goal" && (
            <>
              <Field label="Goal name">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Miami trip" />
              </Field>
              <Field label="Per week">
                <Input type="number" min="0" step="0.01" value={weeklyAmount} onChange={(e) => setWeeklyAmount(e.target.value)} />
              </Field>
              <Field label="For (weeks)">
                <Input type="number" min="1" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
              </Field>
            </>
          )}
        </div>

        <ScenarioChart
          baseline={baselinePoints}
          scenario={scenarioPoints}
          scenarioLabel={scenarioLabel}
          bufferThreshold={bufferThreshold}
          todayIndex={todayIndex}
        />

        <div className="grid sm:grid-cols-3 gap-3">
          <StatCard
            label="Minimum projected balance"
            value={formatCurrency(scenarioSummary.minBalance, { cents: true })}
            sublabel={`Baseline: ${formatCurrency(baselineSummary.minBalance, { cents: true })}`}
            tone={getsWorse ? "caution" : "positive"}
          />
          <StatCard
            label="Bills at risk"
            value={`${scenarioBillsAtRisk} / ${bills.length}`}
            sublabel={`Baseline: ${baselineBillsAtRisk} / ${bills.length}`}
            tone={scenarioBillsAtRisk > baselineBillsAtRisk ? "caution" : "positive"}
          />
          <StatCard
            label="Buffer"
            value={formatCurrency(bufferThreshold)}
            sublabel="Your preferred minimum"
            tone="neutral"
          />
        </div>

        <p className="text-xs text-muted-foreground">Scenario minimum without uncertain repayments: {formatCurrency(conservativeMinimum, { cents: true })}. {conservativeMinimum < bufferThreshold ? "This falls below your buffer." : "This stays above your buffer in the visible forecast."}</p>
        <div className="rounded-lg bg-accent px-4 py-3 space-y-2">
          <p className="flex items-start gap-2 text-sm">
            {getsWorse ? (
              <AlertTriangle className="size-4 mt-0.5 shrink-0 text-caution" />
            ) : (
              <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-positive" />
            )}
            <span>{suggestedAction || "Choose scenario inputs above to see a suggestion."}</span>
          </p>
          {assumptions.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-0.5 pl-6 list-disc">
              {assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6">
            <ShieldCheck className="size-3.5 shrink-0" />
            Reversible — nothing here changes your real transactions or bills.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {isValidElement(children) ? cloneElement(children, { id } as object) : children}
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string;
  sublabel: string;
  tone: "positive" | "caution" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          "font-heading text-lg font-semibold mt-0.5 " +
          (tone === "positive" ? "text-positive" : tone === "caution" ? "text-caution" : "text-foreground")
        }
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
    </div>
  );
}

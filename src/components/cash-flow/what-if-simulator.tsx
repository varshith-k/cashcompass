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
  balanceDescription?: string;
  bufferThreshold: number;
  forecastDays: number;
  historyDays: number;
  nextPaydayDate: string | null;
  /** Estimated everyday spending per day. */
  dailySpend: number;
  initialAmount?: string;
  initialLabel?: string;
}

export function WhatIfSimulator({
  events,
  openingBalance,
  balanceDescription = "Forecast from your opening balance and recorded events.",
  bufferThreshold,
  forecastDays,
  historyDays,
  nextPaydayDate,
  dailySpend,
  initialAmount = "150",
  initialLabel = "",
}: WhatIfSimulatorProps) {
  const [kind, setKind] = useState<ScenarioKind>("buy-now");
  const [amount, setAmount] = useState(initialAmount);
  const [label, setLabel] = useState(initialLabel);
  const [delayDays, setDelayDays] = useState("7");
  const [weeklyAmount, setWeeklyAmount] = useState("50");
  const [weeks, setWeeks] = useState("8");

  const bills = useMemo(() => selectUpcomingBills(events), [events]);
  const repayments = useMemo(
    () => events.filter((e) => e.certainty === "uncertain" && e.record === "planned"),
    [events],
  );
  // Pre-select the first bill/repayment so every scenario shows a change
  // immediately instead of looking identical to the baseline.
  const [selectedBillId, setSelectedBillId] = useState<string>(() => bills[0]?.id ?? "");
  const [selectedRepaymentId, setSelectedRepaymentId] = useState<string>(() => repayments[0]?.id ?? "");

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
        dailySpend,
      }),
    [openingBalance, events, startDate, forecastDays, bufferThreshold, dailySpend],
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
          suggestedAction: "Only delay a bill if the biller allows it. This doesn't contact them for you.",
        };
      }
      case "repayment-late": {
        const original = repayments.find((r) => r.id === selectedRepaymentId);
        if (!original) return { scenarioEvents: events, assumptions: ["Pick a repayment to delay."], suggestedAction: "" };
        const shifted = buildShiftedEvent(original, delay);
        return {
          scenarioEvents: events.filter((e) => e.id !== original.id).concat(shifted),
          assumptions: [`Assumes ${original.counterparty}'s repayment arrives ${delay} day(s) late, on ${formatShortDate(shifted.date)}.`],
          suggestedAction: "Don't count on money a friend owes you to cover a bill due before they pay.",
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
        dailySpend,
      }),
    [openingBalance, scenarioEvents, startDate, forecastDays, bufferThreshold, dailySpend],
  );

  const baselineSummary = summarizeForecast(baselinePoints.slice(todayIndex));
  const conservativeMinimum = Math.min(...scenarioPoints.slice(todayIndex).map((point) => point.conservativeBalance));
  const scenarioSummary = summarizeForecast(scenarioPoints.slice(todayIndex));
  const baselineBillsAtRisk = countBillsAtRisk(bills, baselinePoints);
  const scenarioBillsAtRisk = countBillsAtRisk(selectUpcomingBills(scenarioEvents), scenarioPoints);
  const scenarioLabel = SCENARIOS.find((s) => s.value === kind)?.label ?? "Scenario";
  const getsWorse = scenarioSummary.minBalance < baselineSummary.minBalance - 0.01;
  // The minimum often doesn't move (e.g. a change after the low point), so also
  // surface the largest day-by-day difference from the baseline.
  const biggestChange = scenarioPoints.slice(todayIndex).reduce<{ diff: number; date: string | null }>(
    (best, point, i) => {
      const diff = point.projectedBalance - (baselinePoints[todayIndex + i]?.projectedBalance ?? point.projectedBalance);
      return Math.abs(diff) > Math.abs(best.diff) + 0.005 ? { diff, date: point.date } : best;
    },
    { diff: 0, date: null },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>What-if simulator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">{balanceDescription} Monthly bills and paychecks repeat; everyday spending is estimated at {formatCurrency(dailySpend, { cents: true })}/day from your last 30 days. Money friends owe you may not arrive on time. Results cover the visible forecast only.</p>
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
                        return bill ? `${bill.counterparty} (${formatCurrency(bill.amount)})` : "Choose a bill";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {bills.map((bill) => (
                      <SelectItem key={bill.id} value={bill.id}>
                        {bill.counterparty} ({formatCurrency(bill.amount)})
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
                        return repayment ? `${repayment.counterparty} (${formatCurrency(repayment.amount)})` : "Choose a repayment";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {repayments.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.counterparty} ({formatCurrency(r.amount)})
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
            sublabel={`Baseline: ${formatCurrency(baselineSummary.minBalance, { cents: true })} · Buffer: ${formatCurrency(bufferThreshold)}`}
            tone={getsWorse ? "caution" : "positive"}
          />
          <StatCard
            label="Bills at risk"
            value={`${scenarioBillsAtRisk} / ${bills.length}`}
            sublabel={`Baseline: ${baselineBillsAtRisk} / ${bills.length}`}
            tone={scenarioBillsAtRisk > baselineBillsAtRisk ? "caution" : "positive"}
          />
          <StatCard
            label="Biggest change vs baseline"
            value={biggestChange.date ? `${biggestChange.diff > 0 ? "+" : "−"}${formatCurrency(Math.abs(biggestChange.diff), { cents: true })}` : "No change"}
            sublabel={biggestChange.date ? `On ${formatShortDate(biggestChange.date)}` : "Adjust the inputs above"}
            tone={biggestChange.diff < -0.005 ? "caution" : "neutral"}
          />
        </div>

        <p className="text-xs text-muted-foreground">Scenario minimum without money owed to you: {formatCurrency(conservativeMinimum, { cents: true })}. {conservativeMinimum < bufferThreshold ? "This falls below your buffer." : "This stays above your buffer in the visible forecast."}</p>
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
            Reversible: nothing here changes your real transactions or bills.
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

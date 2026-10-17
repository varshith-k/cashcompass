"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint } from "@/lib/finance/types";
import { formatCurrency, formatShortDate } from "@/lib/format";

// Muted baseline vs. bold scenario, so the two lines are easy to tell apart.
const BASELINE_COLOR = "var(--muted-foreground)";
const SCENARIO_COLOR = "var(--interactive)";

interface ScenarioChartProps {
  baseline: ForecastPoint[];
  scenario: ForecastPoint[];
  scenarioLabel: string;
  bufferThreshold: number;
  todayIndex: number;
}

export function ScenarioChart({
  baseline,
  scenario,
  scenarioLabel,
  bufferThreshold,
  todayIndex,
}: ScenarioChartProps) {
  const data = baseline.map((point, i) => ({
    date: point.date,
    baselineBalance: point.projectedBalance,
    scenarioBalance: scenario[i]?.projectedBalance ?? point.projectedBalance,
  }));

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
        <LegendKey color={BASELINE_COLOR} label="Baseline" />
        <LegendKey color={SCENARIO_COLOR} label={scenarioLabel} />
      </div>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="scenarioBaselineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BASELINE_COLOR} stopOpacity={0.1} />
                <stop offset="100%" stopColor={BASELINE_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              minTickGap={32}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(value: number) => formatCurrency(value)}
              width={64}
            />
            <ReferenceLine
              y={bufferThreshold}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{ value: "Buffer", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <ReferenceLine x={data[todayIndex]?.date} stroke="var(--border)" />
            <Tooltip content={<ScenarioTooltip scenarioLabel={scenarioLabel} />} />
            <Area
              type="monotone"
              dataKey="baselineBalance"
              stroke={BASELINE_COLOR}
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="url(#scenarioBaselineFill)"
              dot={false}
              activeDot={{ r: 4, fill: BASELINE_COLOR, stroke: "var(--card)", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="scenarioBalance"
              stroke={SCENARIO_COLOR}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: SCENARIO_COLOR, stroke: "var(--card)", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Compare daily balances in a table</summary>
        <div className="max-h-56 overflow-auto mt-2">
          <table className="w-full text-left tabular-nums"><caption className="sr-only">Baseline versus scenario daily forecast</caption><thead><tr><th scope="col">Date</th><th scope="col">Baseline</th><th scope="col">Scenario</th></tr></thead>
            <tbody>{data.map((point) => <tr key={point.date}><th scope="row">{formatShortDate(point.date)}</th><td>{formatCurrency(point.baselineBalance, { cents: true })}</td><td>{formatCurrency(point.scenarioBalance, { cents: true })}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function ScenarioTooltip({
  active,
  payload,
  label,
  scenarioLabel,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  scenarioLabel: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const baselineValue = payload.find((p) => p.dataKey === "baselineBalance")?.value;
  const scenarioValue = payload.find((p) => p.dataKey === "scenarioBalance")?.value;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm">
      <p className="text-muted-foreground text-xs">{formatShortDate(label)}</p>
      {baselineValue !== undefined && (
        <p className="flex items-center gap-1.5 mt-1">
          <span className="inline-block w-2.5 h-0.5 rounded-full shrink-0" style={{ backgroundColor: BASELINE_COLOR }} />
          <span className="font-medium tabular-nums">{formatCurrency(baselineValue, { cents: true })}</span>
          <span className="text-xs text-muted-foreground">Baseline</span>
        </p>
      )}
      {scenarioValue !== undefined && (
        <p className="flex items-center gap-1.5 mt-0.5">
          <span className="inline-block w-2.5 h-0.5 rounded-full shrink-0" style={{ backgroundColor: SCENARIO_COLOR }} />
          <span className="font-medium tabular-nums">{formatCurrency(scenarioValue, { cents: true })}</span>
          <span className="text-xs text-muted-foreground">{scenarioLabel}</span>
        </p>
      )}
    </div>
  );
}

"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import type { ForecastPoint } from "@/lib/finance/types";
import { formatCurrency, formatShortDate } from "@/lib/format";

interface ForecastChartProps {
  points: ForecastPoint[];
  bufferThreshold: number;
  todayIndex: number;
}

export function ForecastChart({ points, bufferThreshold, todayIndex }: ForecastChartProps) {
  const riskDates = points.slice(todayIndex).filter((p) => p.isLowBalanceRisk);

  return (
    <div>
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--interactive)" stopOpacity={0.1} />
                <stop offset="100%" stopColor="var(--interactive)" stopOpacity={0} />
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
              label={{
                value: "Buffer",
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
            <ReferenceLine
              x={points[todayIndex]?.date}
              stroke="var(--border)"
              label={{
                value: "Today",
                position: "top",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
            <Tooltip content={<ForecastTooltip todayIndex={todayIndex} points={points} />} />
            <Line type="monotone" dataKey="conservativeBalance" name="Without money owed to you" stroke="var(--caution)" strokeDasharray="5 5" dot={false} />
            <Area
              type="monotone"
              dataKey="projectedBalance"
              stroke="var(--interactive)"
              strokeWidth={2}
              fill="url(#balanceFill)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--interactive)", stroke: "var(--card)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Forecast assumptions and daily balances</summary>
        <p className="my-2">Blue: expected balance. Dashed: balance without money friends owe you. Monthly bills repeat; other unrecorded activity is excluded. Projections are estimates.</p>
        <div className="max-h-56 overflow-auto">
          <table className="w-full text-left tabular-nums"><caption className="sr-only">Daily cash-flow forecast</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Expected</th><th scope="col">Without money owed to you</th></tr></thead>
            <tbody>{points.map((point) => <tr key={point.date}><th scope="row">{formatShortDate(point.date)}</th><td>{formatCurrency(point.projectedBalance, { cents: true })}</td><td>{formatCurrency(point.conservativeBalance, { cents: true })}{point.isLowBalanceRisk ? " · Below buffer" : ""}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
      {riskDates.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-caution/10 text-caution px-3 py-2 text-sm">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <p>
            Low-balance risk: {formatShortDate(riskDates[0].date)}
            {riskDates.length > 1 &&
              ` – ${formatShortDate(riskDates[riskDates.length - 1].date)}`}
            . Projected balance dips below your buffer.
          </p>
        </div>
      )}
    </div>
  );
}

function ForecastTooltip({
  active,
  payload,
  points,
  todayIndex,
}: {
  active?: boolean;
  payload?: { payload: ForecastPoint }[];
  points: ForecastPoint[];
  todayIndex: number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const index = points.findIndex((p) => p.date === point.date);
  const isProjected = index >= todayIndex;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm">
      <p className="text-muted-foreground text-xs">{formatShortDate(point.date)}</p>
      <p className="font-heading font-semibold tabular-nums mt-0.5">
        {formatCurrency(point.projectedBalance, { cents: true })}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {isProjected ? "Projected" : "Actual"}
        {point.isLowBalanceRisk && " · below buffer"}
      </p>
    </div>
  );
}

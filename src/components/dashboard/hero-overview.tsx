import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatShortDate } from "@/lib/format";

interface HeroOverviewProps {
  availableBalance: number;
  safeToSpend: number;
  reservedForBills: number;
  savingsEarmarks: number;
  debtsOwed: number;
  everydaySpending: number;
  dailySpend: number;
  /** Safe to Spend covers the period up to this date (next payday, or 30 days). */
  windowEndDate: string;
  preferredBuffer: number;
  nextPaydayDate: string | null;
  nextPaydayAmount: number;
  outlook: "on-track" | "tight" | "at-risk";
}

const OUTLOOK_COPY: Record<HeroOverviewProps["outlook"], string> = {
  "on-track": "On track through your next payday",
  tight: "Tight: a few days run close to your buffer",
  "at-risk": "At risk: a bill may not be covered",
};

export function HeroOverview({
  availableBalance,
  safeToSpend,
  reservedForBills,
  savingsEarmarks,
  debtsOwed,
  everydaySpending,
  dailySpend,
  windowEndDate,
  preferredBuffer,
  nextPaydayDate,
  nextPaydayAmount,
  outlook,
}: HeroOverviewProps) {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-brand-navy to-[#015E8E] text-white p-6 sm:p-8 shadow-sm">
      <p className="text-sm text-white/70">Good {timeOfDay()}. Here&rsquo;s where your money stands.</p>
      <h2 className="font-heading text-lg sm:text-xl font-semibold mt-1">
        {OUTLOOK_COPY[outlook]}
      </h2>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
        <Stat label="Available balance" value={formatCurrency(availableBalance)} />
        <Stat
          label="Safe to Spend"
          value={formatCurrency(safeToSpend)}
          highlight
          tooltip={`Until ${formatShortDate(windowEndDate)}: ${formatCurrency(availableBalance, { cents: true })} available − ${formatCurrency(reservedForBills, { cents: true })} bills − ${formatCurrency(savingsEarmarks, { cents: true })} planned savings − ${formatCurrency(debtsOwed, { cents: true })} you owe − ${formatCurrency(everydaySpending, { cents: true })} everyday spending (about ${formatCurrency(dailySpend, { cents: true })}/day) − ${formatCurrency(preferredBuffer)} buffer = ${formatCurrency(safeToSpend, { cents: true })} (minimum $0). Expected income is excluded.`}
        />
        <Stat label="Bills before payday" value={formatCurrency(reservedForBills)} />
        <Stat
          label="Next payday"
          value={nextPaydayDate ? formatCurrency(nextPaydayAmount) : "Not scheduled"}
          sublabel={nextPaydayDate ? formatShortDate(nextPaydayDate) : undefined}
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sublabel,
  highlight,
  tooltip,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
  tooltip?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-white/70">
        <span>{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger aria-label={`About ${label}`}>
              <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <p
        className={`font-heading text-2xl sm:text-3xl font-semibold mt-1 ${
          highlight ? "text-[#2DD4BF]" : "text-white"
        }`}
      >
        {value}
      </p>
      {sublabel && <p className="text-xs text-white/60 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function timeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

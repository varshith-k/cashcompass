import { BalanceSetupNotice } from "@/components/dashboard/balance-setup-notice";
import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { WhatIfSimulator } from "@/components/cash-flow/what-if-simulator";
import { DEMO_PREFERRED_BUFFER } from "@/lib/finance/demo-data";
import { getFinancialSnapshot } from "@/lib/finance/snapshot";

const FORECAST_HISTORY_DAYS = 5;
const FORECAST_TOTAL_DAYS = 35;

export default async function CashFlowPage({ searchParams }: { searchParams: Promise<{ amount?: string; label?: string }> }) {
  await connection();

  const params = await searchParams;
  const amount = typeof params.amount === "string" && Number.isFinite(Number(params.amount)) && Number(params.amount) > 0 ? String(Math.min(9999999999.99, Number(params.amount))) : undefined;
  const label = typeof params.label === "string" ? params.label.slice(0, 120) : "";
  const snapshot = await getFinancialSnapshot();
  const { balanceBasis, events } = snapshot;
  if (balanceBasis.source === "unconfigured") return <BalanceSetupNotice />;

  const nextPayday = events
    .filter((e) => e.category === "Payroll" && e.record === "planned" && e.date.slice(0, 10) >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash Flow"
        description="Your forecast, and what changes when you move a purchase, a bill, or a repayment."
      />
      <WhatIfSimulator
        initialAmount={amount}
        initialLabel={label}
        events={events}
        balanceDescription={balanceBasis.description}
        openingBalance={balanceBasis.openingBalance}
        bufferThreshold={DEMO_PREFERRED_BUFFER}
        forecastDays={FORECAST_TOTAL_DAYS}
        historyDays={FORECAST_HISTORY_DAYS}
        nextPaydayDate={nextPayday?.date ?? null}
      />
    </div>
  );
}

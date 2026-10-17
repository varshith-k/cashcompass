import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { WhatIfSimulator } from "@/components/cash-flow/what-if-simulator";
import { DEMO_PREFERRED_BUFFER, DEMO_STARTING_BALANCE } from "@/lib/finance/demo-data";
import { getFinancialEventRepository } from "@/lib/finance/repository";

const FORECAST_HISTORY_DAYS = 5;
const FORECAST_TOTAL_DAYS = 35;

export default async function CashFlowPage() {
  await connection();

  const events = await getFinancialEventRepository().listEvents();

  const nextPayday = events
    .filter((e) => e.category === "Payroll" && e.record === "planned")
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash Flow"
        description="Your forecast, and what changes when you move a purchase, a bill, or a repayment."
      />
      <WhatIfSimulator
        events={events}
        openingBalance={DEMO_STARTING_BALANCE}
        bufferThreshold={DEMO_PREFERRED_BUFFER}
        forecastDays={FORECAST_TOTAL_DAYS}
        historyDays={FORECAST_HISTORY_DAYS}
        nextPaydayDate={nextPayday?.date ?? new Date().toISOString()}
      />
    </div>
  );
}

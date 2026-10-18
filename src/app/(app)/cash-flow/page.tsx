import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { WhatIfSimulator } from "@/components/cash-flow/what-if-simulator";
import { forecastInputs } from "@/lib/finance/forecast-inputs";
import { getFinancialEventRepository } from "@/lib/finance/repository";

export default async function CashFlowPage({ searchParams }: { searchParams: Promise<{ amount?: string; label?: string }> }) {
  await connection();

  const params = await searchParams;
  const amount = typeof params.amount === "string" && Number.isFinite(Number(params.amount)) && Number(params.amount) > 0 ? String(Math.min(9999999999.99, Number(params.amount))) : undefined;
  const label = typeof params.label === "string" ? params.label.slice(0, 120) : "";
  const events = await getFinancialEventRepository().listEvents();

  const inputs = forecastInputs(events);

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
        {...inputs}
      />
    </div>
  );
}

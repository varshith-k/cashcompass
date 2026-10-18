import { connection } from "next/server";
import { PageHeader } from "@/components/shell/page-header";
import { WhatIfSimulator } from "@/components/cash-flow/what-if-simulator";
import { forecastInputs } from "@/lib/finance/forecast-inputs";
import { getFinancialSnapshot } from "@/lib/finance/snapshot";
import { BalanceSetupNotice } from "@/components/dashboard/balance-setup-notice";

export const metadata = { title: "Cash Flow" };

export default async function CashFlowPage({ searchParams }: { searchParams: Promise<{ amount?: string; label?: string }> }) {
  await connection();

  const params = await searchParams;
  const amount = typeof params.amount === "string" && Number.isFinite(Number(params.amount)) && Number(params.amount) > 0 ? String(Math.min(9999999999.99, Number(params.amount))) : undefined;
  const label = typeof params.label === "string" ? params.label.slice(0, 120) : "";
  const { events, balanceBasis } = await getFinancialSnapshot();

  const inputs = { ...forecastInputs(events), openingBalance: balanceBasis.openingBalance };

  return (
    <div className="space-y-6">
      {balanceBasis.source === "unconfigured" && <BalanceSetupNotice />}
      <PageHeader
        title="Cash Flow"
        description="Your forecast, and what changes when you move a purchase, a bill, or a repayment."
      />
      <WhatIfSimulator
        initialAmount={amount}
        initialLabel={label}
        balanceDescription={balanceBasis.description}
        events={events}
        {...inputs}
      />
    </div>
  );
}

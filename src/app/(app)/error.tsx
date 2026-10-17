"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FinancialDataError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-card p-6 space-y-3">
      <AlertTriangle className="size-6 text-caution" />
      <h2 className="font-heading text-lg font-semibold">Unable to load your financial data</h2>
      <p className="text-sm text-muted-foreground">The data connection may be unavailable. Try again to reload this page.</p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}

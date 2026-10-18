import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BalanceSetupNotice() {
  return <Card>
    <CardHeader><CardTitle>Set your available funds to start forecasting</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Confirm your current balance in Settings or synchronize a Nessie sandbox account. Your transactions and plans are saved; an opening balance is needed to calculate available funds.</p>
      <Link href="/settings" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Set available funds</Link>
    </CardContent>
  </Card>;
}

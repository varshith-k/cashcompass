import { saveBalanceCheckpoint } from "@/lib/finance/actions";
import { getFinancialSnapshot } from "@/lib/finance/snapshot";
import { computeAvailableBalance } from "@/lib/finance/calculations";
import { ActionForm } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { connection } from "next/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PageHeader } from "@/components/shell/page-header";
import { AccountCard } from "@/components/settings/account-card";
import { NessieCard } from "@/components/settings/nessie-card";
import { isNessieConfigured } from "@/lib/nessie/client";
import { listUserAccounts } from "@/lib/nessie/accounts";
import { requireSession } from "@/lib/auth/session";
import { isProfileEditingEnabled } from "@/lib/auth/management";
import { isMfaRequired } from "@/lib/auth/config";
import { LoginSecurityCard } from "@/components/settings/login-security-card";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await connection();
  const session = await requireSession();
  const snapshot = await getFinancialSnapshot();
  const { balanceBasis: basis, events } = snapshot;
  const available = computeAvailableBalance(basis.openingBalance, events);
  const { accounts, error } = await listUserAccounts();

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader title="Settings" description="Manage your account, balance, and preferences." />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)] [&_[data-slot=card]]:[--card-spacing:--spacing(5)] sm:[&_[data-slot=card]]:[--card-spacing:--spacing(6)]">
        <div className="min-w-0 space-y-6">
          <AccountCard canEditProfile={session.source === "auth0" && isProfileEditingEnabled()} />

          <Card>
            <CardHeader>
              <CardTitle>Available funds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm leading-6 text-muted-foreground">{basis.description}</p>
              <ActionForm action={saveBalanceCheckpoint} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="available-funds">Current available balance</Label>
                  <Input id="available-funds" name="balance" type="number" min="0" step="0.01" required defaultValue={basis.source === "unconfigured" ? "" : Math.max(0, available).toFixed(2)} className="h-11" aria-describedby="available-funds-help" />
                </div>
                <Button type="submit" className="h-11">Save balance</Button>
              </ActionForm>
              <p id="available-funds-help" className="rounded-lg bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
                Saving updates your forecast without adding a transaction. Future recorded activity adjusts this balance. Syncing Nessie replaces this checkpoint with its sandbox balance.
              </p>
            </CardContent>
          </Card>

          <NessieCard canSetup={session.source === "auth0" && isNessieConfigured() && Boolean(process.env.DATABASE_URL)} accounts={accounts} accountError={error} isConfigured={isNessieConfigured()} initialStatus={snapshot.profile.syncStatus} />
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Theme</p>
                <p className="text-sm leading-5 text-muted-foreground">Light, dark, or match your system.</p>
              </div>
              <ThemeToggle />
            </CardContent>
          </Card>

          <LoginSecurityCard required={isMfaRequired()} isDemo={session.source === "demo"} />
        </div>
      </div>
    </div>
  );
}

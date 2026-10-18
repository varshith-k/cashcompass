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

export default async function SettingsPage() {
  await connection();
  const session = await requireSession();
  const snapshot = await getFinancialSnapshot();
  const { balanceBasis: basis, events } = snapshot;
  const available = computeAvailableBalance(basis.openingBalance, events);
  const { accounts, error } = await listUserAccounts();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Account, appearance, and demo data preferences." />

      <AccountCard canEditProfile={session.source === "auth0" && isProfileEditingEnabled()} />

      <LoginSecurityCard required={isMfaRequired()} isDemo={session.source === "demo"} />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-sm text-muted-foreground">Light, dark, or match your system.</p>
          </div>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Available funds</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{basis.description}</p>
          <ActionForm action={saveBalanceCheckpoint} className="space-y-2">
            <Label htmlFor="available-funds">Confirm your current available balance</Label>
            <Input id="available-funds" name="balance" type="number" min="0" step="0.01" required defaultValue={basis.source === "unconfigured" ? "" : Math.max(0, available).toFixed(2)} />
            <Button type="submit">Save balance checkpoint</Button>
          </ActionForm>
          <p className="text-xs text-muted-foreground">Updates your forecast without creating a transaction. Recorded activity after this checkpoint adjusts the balance. Synchronizing Nessie uses its latest simulated account balances instead.</p>
        </CardContent>
      </Card>
      <NessieCard canSetup={session.source === "auth0" && isNessieConfigured() && Boolean(process.env.DATABASE_URL)} accounts={accounts} accountError={error} isConfigured={isNessieConfigured()} initialStatus={snapshot.profile.syncStatus} />
    </div>
  );
}

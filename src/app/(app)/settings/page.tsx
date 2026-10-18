import { connection } from "next/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PageHeader } from "@/components/shell/page-header";
import { AccountCard } from "@/components/settings/account-card";
import { NessieCard } from "@/components/settings/nessie-card";
import { isNessieConfigured } from "@/lib/nessie/client";
import { listDemoAccounts } from "@/lib/nessie/accounts";
import { getSyncStatus } from "@/lib/nessie/status";
import { requireSession } from "@/lib/auth/session";
import { isProfileEditingEnabled } from "@/lib/auth/management";
import { isMfaRequired } from "@/lib/auth/config";
import { LoginSecurityCard } from "@/components/settings/login-security-card";

export default async function SettingsPage() {
  await connection();
  const session = await requireSession();
  const ownerId = session.user.id;
  const { accounts, error } = await listDemoAccounts();

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

      <NessieCard accounts={accounts} accountError={error} isConfigured={isNessieConfigured()} initialStatus={getSyncStatus(ownerId)} />
    </div>
  );
}

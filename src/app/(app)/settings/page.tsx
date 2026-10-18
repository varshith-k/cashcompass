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
import { getAuth0LoginSecurity, isLoginSecurityEnabled, isProfileEditingEnabled } from "@/lib/auth/management";
import { LoginSecurityCard } from "@/components/settings/login-security-card";
import { toLoginSecurityLevel, type LoginSecurityLevel } from "@/lib/auth/login-security";

async function loadLoginSecurity(source: string, userId: string): Promise<{ level: LoginSecurityLevel | null; emailVerified: boolean; unavailableReason?: string }> {
  if (source !== "auth0") return { level: null, emailVerified: false, unavailableReason: "Demo mode: sign-in security is handled by Auth0, which isn't connected on this server." };
  if (!isLoginSecurityEnabled()) return { level: null, emailVerified: false, unavailableReason: "Sign-in security isn't set up on this deployment yet (see docs/AUTH0_SETUP.md §7)." };
  try {
    const current = await getAuth0LoginSecurity(userId);
    return { level: toLoginSecurityLevel(current.level), emailVerified: current.emailVerified };
  } catch (error) {
    console.error("[auth] login security read failed:", error instanceof Error ? error.message : "unknown error");
    return { level: null, emailVerified: false, unavailableReason: "We couldn't load your sign-in security settings. Refresh to try again." };
  }
}

export default async function SettingsPage() {
  await connection();
  const session = await requireSession();
  const ownerId = session.user.id;
  const [{ accounts, error }, security] = await Promise.all([listDemoAccounts(), loadLoginSecurity(session.source, ownerId)]);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Account, appearance, and demo data preferences." />

      <AccountCard canEditProfile={session.source === "auth0" && isProfileEditingEnabled()} />

      <LoginSecurityCard
        initialLevel={security.level}
        emailVerified={security.emailVerified}
        email={session.user.email}
        unavailableReason={security.unavailableReason}
      />

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

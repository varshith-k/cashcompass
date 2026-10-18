import { getSession } from "@/lib/auth/session";
import { AuthProvider } from "@/lib/auth/provider";
import { settlementRecipient } from "@/lib/solana/server-config";
import { SolanaProvider } from "@/lib/solana/provider";
import { AppShell } from "@/components/shell/app-shell";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { buildReminders } from "@/lib/finance/reminders";
import { NessieAccountSetup } from "@/components/settings/nessie-account-setup";
import { getNessieMappingStore } from "@/lib/nessie/mapping-store";
import { isNessieConfigured } from "@/lib/nessie/client";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  // The signed-in user's own events (the repository is owner-scoped).
  const reminders = session ? buildReminders(await getFinancialEventRepository().listEvents()) : [];

  const setupEnabled = session?.source === "auth0" && isNessieConfigured() && Boolean(process.env.DATABASE_URL);
  let needsSandbox = false;
  if (setupEnabled) {
    try { needsSandbox = !(await getNessieMappingStore().get(session!.user.id))?.account_id; }
    catch { needsSandbox = true; }
  }

  return (
    <AuthProvider session={session}>
      <SolanaProvider recipientAddress={settlementRecipient()}>
        <AppShell reminders={reminders} nessieConnected={setupEnabled && !needsSandbox}>
          {needsSandbox && <NessieAccountSetup />}
          {children}
        </AppShell>
      </SolanaProvider>
    </AuthProvider>
  );
}

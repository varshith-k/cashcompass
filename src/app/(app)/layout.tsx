import { settlementRecipient } from "@/lib/solana/server-config";
import { getSession } from "@/lib/auth/session";
import { AuthProvider } from "@/lib/auth/provider";
import { SolanaProvider } from "@/lib/solana/provider";
import { AppShell } from "@/components/shell/app-shell";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { buildReminders } from "@/lib/finance/reminders";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  // The signed-in user's own events (the repository is owner-scoped).
  const reminders = session ? buildReminders(await getFinancialEventRepository().listEvents()) : [];

  return (
    <AuthProvider session={session}>
      <SolanaProvider recipientAddress={settlementRecipient()}>
        <AppShell reminders={reminders}>{children}</AppShell>
      </SolanaProvider>
    </AuthProvider>
  );
}

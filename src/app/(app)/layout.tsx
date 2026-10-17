import { getSession } from "@/lib/auth/session";
import { AuthProvider } from "@/lib/auth/provider";
import { SolanaProvider } from "@/lib/solana/provider";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <AuthProvider session={session}>
      <SolanaProvider>
        <AppShell>{children}</AppShell>
      </SolanaProvider>
    </AuthProvider>
  );
}

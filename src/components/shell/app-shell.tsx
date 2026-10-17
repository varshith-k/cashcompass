import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./mobile-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <div className="lg:pl-64 flex flex-col min-h-dvh">
        <Topbar />
        <main className="flex-1 px-4 py-6 pb-24 md:pb-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

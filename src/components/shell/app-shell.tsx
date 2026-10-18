import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./mobile-nav";
import type { Reminder } from "@/lib/finance/reminders";

export function AppShell({ children, reminders = [] }: { children: React.ReactNode; reminders?: Reminder[] }) {
  return (
    <div className="min-h-dvh bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground focus:outline-2 focus:outline-offset-2 focus:outline-ring">
        Skip to content
      </a>
      <Sidebar />
      <div className="lg:pl-64 flex flex-col min-h-dvh">
        <Topbar reminders={reminders} />
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 pb-24 md:pb-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

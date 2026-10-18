"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { CashCompassMark } from "@/components/brand/cash-compass-mark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, SETTINGS_ITEM } from "./nav-items";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNavTrigger() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground border-sidebar-border p-0">
        <SheetHeader className="h-16 flex-row items-center px-6">
          <CashCompassMark size={28} />
          <SheetTitle className="font-heading text-lg text-sidebar-foreground">
            CashCompass
          </SheetTitle>
        </SheetHeader>
        <nav className="px-3 py-2 space-y-1">
          {[...NAV_ITEMS, SETTINGS_ITEM].map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-11",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="size-4.5 shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

// Select by route so inserting a companion page cannot displace AI Copilot.
const BOTTOM_NAV_ITEMS = ["/overview", "/cash-flow", "/copilot"].map(
  (href) => NAV_ITEMS.find((item) => item.href === href)!,
);

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch border-t border-border bg-background/95 backdrop-blur">
      {BOTTOM_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 min-h-14 text-[11px] font-medium",
              active ? "text-interactive" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} />
            {item.label.split(" ")[0]}
          </Link>
        );
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button
              className="flex-1 flex flex-col items-center justify-center gap-1 min-h-14 text-[11px] font-medium text-muted-foreground"
              aria-label="More navigation options"
            >
              <Menu className="size-5" strokeWidth={1.75} />
              More
            </button>
          }
        />
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <nav className="grid grid-cols-3 gap-2 px-4 pb-6">
            {[...NAV_ITEMS, SETTINGS_ITEM].map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-lg p-3 text-xs font-medium min-h-18",
                    active ? "bg-secondary text-brand-navy dark:text-primary" : "text-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                  <span className="text-center leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

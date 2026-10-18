"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLinkItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/lib/auth/provider";
import type { Reminder } from "@/lib/finance/reminders";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, SETTINGS_ITEM } from "./nav-items";
import { MobileNavTrigger } from "./mobile-nav";

export function Topbar({ reminders = [], nessieConnected = false }: { reminders?: Reminder[]; nessieConnected?: boolean }) {
  const pathname = usePathname();
  const { user, source, logoutHref } = useAuth();
  const current = [...NAV_ITEMS, SETTINGS_ITEM].find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const initials = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 lg:px-8">
      <MobileNavTrigger />

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-none">CashCompass</p>
        <h1 className="font-heading text-base font-semibold leading-tight truncate">
          {current?.label ?? "Overview"}
        </h1>
      </div>

      <div className="hidden md:flex flex-1 max-w-sm ml-4">
        <form action="/transactions" className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            name="q"
            type="search"
            placeholder="Search transactions…"
            className="pl-9 bg-secondary/60 border-transparent"
            aria-label="Search"
          />
        </form>
      </div>

      <div className="flex-1" />

      <Badge
        variant="outline"
        className="hidden sm:inline-flex border-interactive/30 text-brand-navy dark:text-primary bg-interactive/10"
      >
        {/* Only claim Nessie when it is actually configured. */}
        {nessieConnected ? "Capital One Nessie demo data" : "Demo data"}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={reminders.length ? `Notifications, ${reminders.length} reminder${reminders.length === 1 ? "" : "s"}` : "Notifications"}
            >
              <Bell className="size-4" />
              {reminders.length > 0 && (
                <span aria-hidden className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-critical text-white text-[10px] font-semibold leading-4 text-center tabular-nums">
                  {reminders.length > 9 ? "9+" : reminders.length}
                </span>
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Reminders · next 7 days</DropdownMenuLabel>
          </DropdownMenuGroup>
          {reminders.length === 0 ? (
            <p className="px-1.5 py-2 text-sm text-muted-foreground">You&apos;re all caught up. No bills or repayments due this week.</p>
          ) : (
            reminders.slice(0, 8).map((reminder) => (
              <DropdownMenuLinkItem key={reminder.id} render={<Link href={reminder.href} />} className="flex-col items-start gap-0">
                <span className="text-sm font-medium">{reminder.title}</span>
                <span className={cn("text-xs", reminder.tone === "overdue" ? "text-critical" : reminder.tone === "soon" ? "text-caution" : "text-muted-foreground")}>
                  {reminder.detail}
                </span>
              </DropdownMenuLinkItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLinkItem render={<Link href="/bills" />}>All bills & payments</DropdownMenuLinkItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="size-8">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
                <AvatarFallback className="bg-brand-navy text-white text-xs">
                  {initials ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">User menu</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          {/* Base UI requires a GroupLabel to sit inside a Group; without it,
              opening the menu throws and crashes the page. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLinkItem render={<Link href="/settings" />}>Settings</DropdownMenuLinkItem>
          {source === "demo" ? (
            <p className="px-1.5 py-1.5 text-xs text-muted-foreground">Demo mode: sign-in is off on this server.</p>
          ) : (
            // Plain <a>: logout is a full-page redirect through Auth0, never a client navigation.
            <DropdownMenuLinkItem href={logoutHref}>Sign out</DropdownMenuLinkItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

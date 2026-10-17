"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/lib/auth/provider";
import { NAV_ITEMS, SETTINGS_ITEM } from "./nav-items";
import { MobileNavTrigger } from "./mobile-nav";

export function Topbar() {
  const pathname = usePathname();
  const { user, logoutHref } = useAuth();
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
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions, bills, goals…"
            className="pl-9 bg-secondary/60 border-transparent"
            aria-label="Search"
          />
        </div>
      </div>

      <div className="flex-1" />

      <Badge
        variant="outline"
        className="hidden sm:inline-flex border-interactive/30 text-interactive bg-interactive/10"
      >
        Capital One Nessie demo data
      </Badge>

      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Bell className="size-4" />
      </Button>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="User menu">
              <Avatar className="size-8">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
                <AvatarFallback className="bg-brand-navy text-white text-xs">
                  {initials ?? "?"}
                </AvatarFallback>
              </Avatar>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<a href="/settings">Settings</a>} />
          <DropdownMenuItem render={<a href={logoutHref}>Sign out</a>} />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: Receipt },
  { label: "Bills & Payments", href: "/bills", icon: CalendarClock },
  { label: "Budgets", href: "/budgets", icon: PiggyBank },
  { label: "Cash Flow", href: "/cash-flow", icon: TrendingUp },
  { label: "Money Owed / Lent", href: "/ledger", icon: HandCoins },
  { label: "Wishlist & Goals", href: "/wishlist", icon: Target },
  { label: "AI Copilot", href: "/copilot", icon: Sparkles },
];

export const SETTINGS_ITEM: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
};

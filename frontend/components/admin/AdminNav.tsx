"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  PackageIcon,
  ServerIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  TagIcon,
  TicketPercentIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/categories", label: "Categories", icon: TagIcon },
  { href: "/admin/services", label: "Services", icon: PackageIcon },
  { href: "/admin/providers", label: "Providers", icon: ServerIcon },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercentIcon },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCartIcon },
  { href: "/admin/wallets", label: "Wallets", icon: WalletIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/settings", label: "Settings", icon: SlidersHorizontalIcon },
];

/**
 * Shared horizontal sub-navigation for every /admin/* page. Before this
 * component existed there was no in-app way to reach any admin page other
 * than /admin/dashboard (typing the URL was the only option) — added
 * alongside the new Providers/Coupons/Settings pages so all 9 admin pages
 * are actually reachable from each other.
 */
export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="-mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 pb-1 md:-mx-8 md:px-8"
    >
      {adminNavItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

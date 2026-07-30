"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardListIcon, HomeIcon, PackageIcon, UserIcon, WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const bottomNavItems = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/services", label: "Services", icon: PackageIcon },
  { href: "/orders", label: "Orders", icon: ClipboardListIcon },
  { href: "/wallet", label: "Wallet", icon: WalletIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

/**
 * Mobile-only bottom tab bar (Home / Services / Orders / Wallet / Profile),
 * inspired by the Tnxverify reference design. Hidden on md+ where the
 * sidebar already covers primary navigation. Sits fixed to the viewport
 * bottom; pages account for its height via `pb-20 md:pb-0` on <main>.
 */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-5">
        {bottomNavItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full transition-colors",
                    active ? "bg-primary/10" : "",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

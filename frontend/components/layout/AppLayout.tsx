"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  UserIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrandMark from "@/components/common/BrandMark";
import ThemeToggle from "@/components/common/ThemeToggle";
import BottomNav from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useCartQuery } from "@/hooks/queries/useCartQueries";
import { useUnreadCountQuery } from "@/hooks/queries/useNotificationsQueries";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/services", label: "Services", icon: PackageIcon },
  { href: "/cart", label: "Cart", icon: ShoppingCartIcon },
  { href: "/wallet", label: "Wallet", icon: WalletIcon },
  { href: "/orders", label: "Orders", icon: ClipboardListIcon },
  { href: "/notifications", label: "Notifications", icon: BellIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

function initialsOf(name: string | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout, isLoggingOut } = useAuth();
  const unread = useUnreadCountQuery();
  const cart = useCartQuery();
  const cartCount = cart.data?.data.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5">
        <div>
          <BrandMark className="h-8 w-auto" />
          <p className="mt-1 text-xs text-muted-foreground">Marketplace dashboard</p>
        </div>
      </div>

      <nav id="primary-navigation" className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          const badgeCount =
            item.href === "/notifications" ? unread.data : item.href === "/cart" ? cartCount : 0;
          const showBadge = Boolean(badgeCount);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </span>
              {showBadge ? (
                <Badge variant={active ? "secondary" : "default"} className="h-5 min-w-5 justify-center px-1.5">
                  {badgeCount}
                </Badge>
              ) : null}
            </Link>
          );
        })}

        {user?.is_admin ? (
          <Link
            href="/admin/dashboard"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname?.startsWith("/admin")
                ? "bg-primary text-primary-foreground"
                : "text-primary hover:bg-primary/10",
            )}
          >
            <ShieldCheckIcon className="size-4" aria-hidden="true" />
            Admin
          </Link>
        ) : null}
      </nav>

      <div className="m-3 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{initialsOf(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full text-destructive hover:bg-destructive/10"
          disabled={isLoggingOut}
          onClick={() => void logout()}
        >
          <LogOutIcon data-icon="inline-start" aria-hidden="true" />
          {isLoggingOut ? "Signing out..." : "Logout"}
        </Button>
      </div>
    </div>
  );
}

function TopbarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const serviceSearchTerm = useUiStore((state) => state.serviceSearchTerm);
  const setServiceSearchTerm = useUiStore((state) => state.setServiceSearchTerm);

  const onChange = (next: string) => {
    setServiceSearchTerm(next);
    if (next && pathname !== "/services") {
      router.push("/services");
    }
  };

  return (
    <div className="relative hidden w-full max-w-xs sm:block">
      <SearchIcon
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={serviceSearchTerm}
        onChange={(event) => onChange(event.target.value)}
        type="search"
        placeholder="Search services..."
        aria-label="Search services"
        className="pl-8"
      />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const mobileSidebarOpen = useUiStore((state) => state.mobileSidebarOpen);
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);
  const setServiceSearchTerm = useUiStore((state) => state.setServiceSearchTerm);
  const pathname = usePathname();
  const { user } = useAuth();

  // Clear the search term whenever the visitor navigates away from Services,
  // so it doesn't silently keep filtering next time they return.
  useEffect(() => {
    if (pathname !== "/services") {
      setServiceSearchTerm("");
    }
  }, [pathname, setServiceSearchTerm]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-7xl md:grid-cols-[260px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden border-r border-border bg-card md:block">
          <SidebarContent />
        </aside>

        {/* Mobile off-canvas sidebar */}
        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-foreground/40"
              onClick={closeMobileSidebar}
            />
            <div className="relative z-10 h-full w-72 max-w-[80vw] border-r border-border bg-card shadow-xl">
              <button
                type="button"
                aria-label="Close navigation"
                className="absolute right-3 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                onClick={closeMobileSidebar}
              >
                <XIcon className="size-5" aria-hidden="true" />
              </button>
              <SidebarContent onNavigate={closeMobileSidebar} />
            </div>
          </div>
        ) : null}

        <div className="flex min-h-screen flex-col">
          {/* Topbar */}
          <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:px-8">
            <button
              type="button"
              aria-label="Open navigation"
              aria-controls="primary-navigation"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
              onClick={openMobileSidebar}
            >
              <MenuIcon className="size-5" aria-hidden="true" />
            </button>
            <BrandMark className="h-7 w-auto md:hidden" />
            <TopbarSearch />
            <div className="ml-auto flex items-center gap-3">
              {user?.is_admin ? <Badge variant="secondary">Admin</Badge> : null}
              <ThemeToggle />
              <Avatar size="sm">
                <AvatarFallback>{initialsOf(user?.name)}</AvatarFallback>
              </Avatar>
            </div>
          </header>

          <main id="main-content" className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
            {children}
          </main>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

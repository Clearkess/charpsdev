"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/services", label: "Services" },
  { href: "/wallet", label: "Wallet" },
  { href: "/orders", label: "Orders" },
  { href: "/notifications", label: "Notifications" },
  { href: "/profile", label: "Profile" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="border-r bg-white p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">{APP_NAME}</h1>
            <p className="mt-1 text-sm text-neutral-500">Digital marketplace dashboard</p>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm transition",
                    active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {user?.is_admin ? (
              <Link
                href="/admin/dashboard"
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm transition",
                  pathname?.startsWith("/admin") ? "bg-blue-600 text-white" : "text-blue-700 hover:bg-blue-50",
                )}
              >
                Admin
              </Link>
            ) : null}
          </nav>
          <div className="mt-10 rounded-xl border p-4 text-sm">
            <p className="font-medium">Signed in as</p>
            <p className="mt-1 break-all text-neutral-600">{user?.name}</p>
            <p className="break-all text-neutral-500">{user?.email}</p>
            <button
              onClick={() => void logout()}
              className="mt-4 w-full rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </aside>
        <main className="p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}

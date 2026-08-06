"use client";

import Link from "next/link";
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  BellIcon,
  ClipboardListIcon,
  PackageIcon,
  ShoppingCartIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBlock, StatCardsSkeleton } from "@/components/common/StateBlock";
import { useWalletQuery } from "@/hooks/queries/useWalletQueries";
import { useOrdersQuery } from "@/hooks/queries/useOrdersQueries";
import { useUnreadCountQuery } from "@/hooks/queries/useNotificationsQueries";
import { useServicesQuery } from "@/hooks/queries/useServicesQuery";
import { extractErrorMessage } from "@/lib/api";
import { splitCurrencyParts } from "@/lib/format";

/**
 * Below-the-wallet quick actions so the most common next steps (fund the
 * wallet, browse the catalog, check order history) are reachable in one
 * tap right after login, instead of requiring a trip through the sidebar.
 * "Withdraw" links into the wallet page rather than a dedicated flow — no
 * withdrawal feature exists yet (deposits only), so it lands users on the
 * page where that would eventually live rather than a dead end.
 */
const quickActions = [
  { href: "/wallet", label: "Deposit Funds", icon: ArrowDownToLineIcon },
  { href: "/wallet", label: "Withdraw", icon: ArrowUpFromLineIcon },
  { href: "/services", label: "Browse Services", icon: PackageIcon },
  { href: "/orders", label: "View Transactions", icon: ClipboardListIcon },
];

export default function DashboardPage() {
  const wallet = useWalletQuery();
  const orders = useOrdersQuery();
  const unread = useUnreadCountQuery();
  const services = useServicesQuery();

  const loading = wallet.isPending || orders.isPending || unread.isPending || services.isPending;
  const error = wallet.error || orders.error || unread.error || services.error;

  if (loading) return <StatCardsSkeleton />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load dashboard data.")} />;

  const balanceParts = splitCurrencyParts(wallet.data?.balance ?? 0, wallet.data?.currency || "NGN");

  const cards = [
    {
      label: "Orders",
      value: String(orders.data?.total ?? orders.data?.data.length ?? 0),
      icon: ShoppingCartIcon,
    },
    {
      label: "Unread notifications",
      value: String(unread.data ?? 0),
      icon: BellIcon,
    },
    {
      label: "Available services",
      value: String(services.data?.length ?? 0),
      icon: PackageIcon,
    },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold md:text-3xl">Dashboard</h1>
        <p className="mt-1.5 text-sm font-normal text-muted-foreground/80">
          An overview of your wallet, orders, notifications, and available services.
        </p>
      </div>

      {/* Wallet balance — the primary card, spaced and centered rather than
          crammed against the card edge, with the currency symbol de-emphasized
          next to a larger amount. */}
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 py-2">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <WalletIcon className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Wallet balance</p>
            <p className="mt-1.5 font-heading font-bold tracking-tight">
              <span className="text-lg align-top text-muted-foreground">{balanceParts.symbol}</span>
              <span className="text-3xl">{balanceParts.amount}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            render={<Link href={action.href} />}
            className="h-auto flex-col gap-2 py-4"
          >
            <action.icon className="size-5" aria-hidden="true" />
            <span className="text-xs font-medium">{action.label}</span>
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => (
          <Card
            key={item.label}
            className="transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/20 active:translate-y-0 active:shadow-sm"
          >
            <CardContent className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="size-4.5" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

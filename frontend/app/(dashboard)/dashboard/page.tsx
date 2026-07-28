"use client";

import { PackageIcon, ShoppingCartIcon, WalletIcon, BellIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBlock, StatCardsSkeleton } from "@/components/common/StateBlock";
import { useWalletQuery } from "@/hooks/queries/useWalletQueries";
import { useOrdersQuery } from "@/hooks/queries/useOrdersQueries";
import { useUnreadCountQuery } from "@/hooks/queries/useNotificationsQueries";
import { useServicesQuery } from "@/hooks/queries/useServicesQuery";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const wallet = useWalletQuery();
  const orders = useOrdersQuery();
  const unread = useUnreadCountQuery();
  const services = useServicesQuery();

  const loading = wallet.isPending || orders.isPending || unread.isPending || services.isPending;
  const error = wallet.error || orders.error || unread.error || services.error;

  if (loading) return <StatCardsSkeleton />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load dashboard data.")} />;

  const cards = [
    {
      label: "Wallet balance",
      value: formatCurrency(wallet.data?.balance ?? 0, wallet.data?.currency || "NGN"),
      icon: WalletIcon,
    },
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
        <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          An overview of your wallet, orders, notifications, and available services.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <Card key={item.label}>
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

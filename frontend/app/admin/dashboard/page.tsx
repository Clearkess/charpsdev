"use client";

import {
  BarChart3Icon,
  CreditCardIcon,
  PackageIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBlock, StatCardsSkeleton } from "@/components/common/StateBlock";
import { Skeleton } from "@/components/ui/skeleton";
import OrdersOverTimeChart from "@/components/charts/OrdersOverTimeChart";
import RevenueChart from "@/components/charts/RevenueChart";
import { useAdminDashboardChartQuery, useAdminDashboardQuery } from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

export default function AdminDashboardPage() {
  const { data, isPending, error } = useAdminDashboardQuery();
  const chart = useAdminDashboardChartQuery();

  if (isPending) return <StatCardsSkeleton count={6} />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load admin dashboard.")} />;

  const cards = [
    { label: "Users", value: String(data?.users ?? 0), icon: UsersIcon },
    { label: "Orders", value: String(data?.orders ?? 0), icon: ShoppingCartIcon },
    { label: "Services", value: String(data?.services ?? 0), icon: PackageIcon },
    { label: "Completed orders", value: String(data?.completed_orders ?? 0), icon: ReceiptIcon },
    { label: "Pending orders", value: String(data?.pending_orders ?? 0), icon: BarChart3Icon },
    { label: "Wallet balance", value: formatCurrency(data?.wallet_balance ?? 0), icon: WalletIcon },
    { label: "Revenue", value: formatCurrency(data?.revenue ?? 0), icon: CreditCardIcon },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Admin dashboard</h1>
        <p className="mt-2 text-muted-foreground">Platform-wide counts, wallet balance, and revenue.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders over time (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {chart.isPending ? (
              <Skeleton className="h-[260px] w-full" />
            ) : chart.error ? (
              <ErrorBlock message={extractErrorMessage(chart.error, "Failed to load chart data.")} />
            ) : (
              <OrdersOverTimeChart data={chart.data ?? []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue over time (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {chart.isPending ? (
              <Skeleton className="h-[260px] w-full" />
            ) : chart.error ? (
              <ErrorBlock message={extractErrorMessage(chart.error, "Failed to load chart data.")} />
            ) : (
              <RevenueChart data={chart.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

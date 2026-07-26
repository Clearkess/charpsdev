"use client";

import { useApiQuery } from "@/hooks/useApiQuery";
import { selectors } from "@/lib/backend";
import { formatCurrency } from "@/lib/format";
import type { CountResponse, NotificationItem, Order, PaginatedResponse, Service, Wallet } from "@/types/api";
import { ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";

export default function DashboardPage() {
  const wallet = useApiQuery<{ success: boolean; data: Wallet }, Wallet>("/wallet", { select: selectors.wallet });
  const orders = useApiQuery<{ success: boolean; data: PaginatedResponse<Order> }, PaginatedResponse<Order>>("/orders", { select: selectors.orders });
  const unread = useApiQuery<CountResponse, number>("/notifications/unread-count", { select: selectors.unreadCount });
  const services = useApiQuery<{ success: boolean; services: Service[] }, Service[]>("/services", { select: selectors.services });

  const loading = wallet.loading || orders.loading || unread.loading || services.loading;
  const error = wallet.error || orders.error || unread.error || services.error;

  if (loading) return <LoadingBlock label="Loading dashboard data..." />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-neutral-600">This page is wired to the exact backend response shapes for wallet, orders, unread notifications, and services.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-sm text-neutral-500">Wallet balance</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(wallet.data?.balance ?? 0, wallet.data?.currency || "NGN")}</p></div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-sm text-neutral-500">Orders</p><p className="mt-2 text-2xl font-semibold">{orders.data?.total ?? orders.data?.data.length ?? 0}</p></div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-sm text-neutral-500">Unread notifications</p><p className="mt-2 text-2xl font-semibold">{unread.data ?? 0}</p></div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-sm text-neutral-500">Available services</p><p className="mt-2 text-2xl font-semibold">{services.data?.length ?? 0}</p></div>
      </div>
    </section>
  );
}

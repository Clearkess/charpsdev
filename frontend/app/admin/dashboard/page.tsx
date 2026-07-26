"use client";

import { useApiQuery } from "@/hooks/useApiQuery";
import { selectors } from "@/lib/backend";
import { formatCurrency } from "@/lib/format";
import { ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";
import type { DashboardStats } from "@/types/api";

export default function AdminDashboardPage() {
  const { data, loading, error } = useApiQuery<{ success: boolean; data: DashboardStats }, DashboardStats>("/admin/dashboard", { select: selectors.adminDashboard });

  if (loading) return <LoadingBlock label="Loading admin dashboard..." />;
  if (error) return <ErrorBlock message={error} />;

  const cards = [
    { label: "Users", value: String(data?.users ?? 0) },
    { label: "Orders", value: String(data?.orders ?? 0) },
    { label: "Services", value: String(data?.services ?? 0) },
    { label: "Completed orders", value: String(data?.completed_orders ?? 0) },
    { label: "Pending orders", value: String(data?.pending_orders ?? 0) },
    { label: "Wallet balance", value: formatCurrency(data?.wallet_balance ?? 0) },
    { label: "Revenue", value: formatCurrency(data?.revenue ?? 0) },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin dashboard</h1>
        <p className="mt-2 text-neutral-600">Wired to the actual <code>/admin/dashboard</code> payload: counts plus <code>wallet_balance</code> and <code>revenue</code>.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm text-neutral-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

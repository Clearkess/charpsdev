"use client";

import { useMemo, useState } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { createOrder, selectors } from "@/lib/backend";
import { formatCurrency, formatDate } from "@/lib/format";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";
import type { Order, PaginatedResponse, Service } from "@/types/api";

export default function OrdersPage() {
  const orders = useApiQuery<{ success: boolean; data: PaginatedResponse<Order> }, PaginatedResponse<Order>>("/orders", { select: selectors.orders });
  const services = useApiQuery<{ success: boolean; services: Service[] }, Service[]>("/services", { select: selectors.services });
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const firstServiceId = useMemo(() => services.data?.[0]?.id?.toString() || "", [services.data]);
  const selectedServiceId = serviceId || firstServiceId;

  if (orders.loading || services.loading) return <LoadingBlock label="Loading orders..." />;
  if (orders.error || services.error) return <ErrorBlock message={orders.error || services.error || "Order request failed"} />;

  const onCreateOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedServiceId) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await createOrder(Number(selectedServiceId), Number(quantity));
      setMessage(response.message || `Order #${response.data.id} created.`);
      orders.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Orders</h1>
        <p className="mt-2 text-neutral-600">This page uses the exact order list shape from <code>/orders</code> and the create endpoint <code>POST /orders</code>.</p>
      </div>
      <form onSubmit={onCreateOrder} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-xl font-semibold">Create order</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <select value={selectedServiceId} onChange={(e) => setServiceId(e.target.value)} className="rounded-lg border px-3 py-2">
            {services.data?.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
          <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="rounded-lg border px-3 py-2" />
        </div>
        <button disabled={submitting || !selectedServiceId} className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-white">{submitting ? "Creating..." : "Create order"}</button>
        {message ? <p className="mt-3 text-sm text-neutral-600">{message}</p> : null}
      </form>
      {!orders.data?.data?.length ? (
        <EmptyBlock title="No orders" description="The paginated `data` array is empty." />
      ) : (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-neutral-500"><tr><th className="px-2 py-3">ID</th><th className="px-2 py-3">Service</th><th className="px-2 py-3">Quantity</th><th className="px-2 py-3">Amount</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Created</th></tr></thead>
              <tbody>
                {orders.data.data.map((order) => (
                  <tr key={order.id} className="border-b last:border-b-0">
                    <td className="px-2 py-3">#{order.id}</td>
                    <td className="px-2 py-3">{order.service?.name || order.service_id || "—"}</td>
                    <td className="px-2 py-3">{order.quantity ?? "—"}</td>
                    <td className="px-2 py-3">{formatCurrency(order.amount ?? order.price ?? 0)}</td>
                    <td className="px-2 py-3 capitalize">{order.status}</td>
                    <td className="px-2 py-3">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

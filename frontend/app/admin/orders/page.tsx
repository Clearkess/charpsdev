"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useAdminOrderUpdateMutation, useAdminOrdersQuery } from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Order, OrderStatus } from "@/types/api";

const STATUS_OPTIONS: OrderStatus[] = ["pending", "processing", "completed", "failed", "cancelled"];

function statusVariant(status: string) {
  const normalized = status?.toLowerCase();
  if (normalized === "completed" || normalized === "success") return "success" as const;
  if (normalized === "cancelled" || normalized === "failed") return "destructive" as const;
  if (normalized === "pending") return "warning" as const;
  return "muted" as const;
}

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const orders = useAdminOrdersQuery(page);
  const updateOrder = useAdminOrderUpdateMutation();
  const [message, setMessage] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);

  // Phase 5 (product delivery emails): which order row (if any) currently has
  // its "Delivery info" textarea open, and its draft content.
  const [deliveringOrderId, setDeliveringOrderId] = useState<number | null>(null);
  const [deliveryDraft, setDeliveryDraft] = useState("");

  const onStatusChange = async (order: Order, status: OrderStatus) => {
    if (status === order.status) return;
    setMessage(null);
    setPendingOrderId(order.id);
    try {
      const response = await updateOrder.mutateAsync({ orderId: order.id, status });
      setMessage(response.message || `Order #${order.id} updated to "${status}".`);
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to update order status."));
    } finally {
      setPendingOrderId(null);
    }
  };

  const startDelivery = (order: Order) => {
    setDeliveringOrderId(order.id);
    setDeliveryDraft(order.delivery_content ?? "");
    setMessage(null);
  };

  const cancelDelivery = () => {
    setDeliveringOrderId(null);
    setDeliveryDraft("");
  };

  const saveDelivery = async (order: Order) => {
    setMessage(null);
    setPendingOrderId(order.id);
    try {
      // Attaching delivery content always marks the order completed — this is
      // what triggers the customer's delivery email on the backend.
      const response = await updateOrder.mutateAsync({
        orderId: order.id,
        status: "completed",
        delivery_content: deliveryDraft.trim(),
      });
      setMessage(response.message || `Delivery info saved for order #${order.id}.`);
      setDeliveringOrderId(null);
      setDeliveryDraft("");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to save delivery info."));
    } finally {
      setPendingOrderId(null);
    }
  };

  const columns = useMemo<ColumnDef<Order, unknown>[]>(
    () => [
      {
        id: "reference",
        header: "Order",
        accessorFn: (row) => row.reference || `#${row.id}`,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.reference || `#${row.original.id}`}</div>
            <div className="text-xs text-muted-foreground">
              {(row.original.details as { service_name?: string } | null)?.service_name ||
                row.original.service?.name ||
                "—"}
            </div>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        accessorFn: (row) => row.user?.name ?? "",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.user?.name || "—"}</div>
            <div className="text-xs text-muted-foreground">{row.original.user?.email}</div>
          </div>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessorFn: (row) => Number(row.amount ?? row.price ?? 0),
        cell: ({ row }) => formatCurrency(row.original.amount ?? row.original.price),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.status,
        cell: ({ row }) => {
          const order = row.original;
          const isBusy = updateOrder.isPending && pendingOrderId === order.id;
          return (
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
              <select
                value={order.status}
                disabled={isBusy}
                onChange={(event) => void onStatusChange(order, event.target.value as OrderStatus)}
                aria-label={`Update status for order ${order.reference || order.id}`}
                className="h-7 rounded-lg border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          );
        },
      },
      {
        id: "delivery",
        header: "Delivery",
        enableSorting: false,
        cell: ({ row }) => {
          const order = row.original;
          const isBusy = updateOrder.isPending && pendingOrderId === order.id;

          if (deliveringOrderId === order.id) {
            return (
              <div className="w-64 space-y-1.5">
                <textarea
                  value={deliveryDraft}
                  onChange={(e) => setDeliveryDraft(e.target.value)}
                  placeholder="License key, PIN, download link, account credentials..."
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent p-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={isBusy || !deliveryDraft.trim()} onClick={() => void saveDelivery(order)}>
                    {isBusy ? "Sending..." : "Save & notify"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelDelivery}>
                    Cancel
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-1">
              {order.delivery_content ? (
                <p className="max-w-[220px] truncate font-mono text-xs text-muted-foreground" title={order.delivery_content}>
                  {order.delivery_content}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Not delivered yet</p>
              )}
              <Button size="sm" variant="outline" onClick={() => startDelivery(order)}>
                {order.delivery_content ? "Edit" : "Add delivery info"}
              </Button>
            </div>
          );
        },
      },
      {
        id: "created",
        header: "Created",
        accessorFn: (row) => row.created_at ?? "",
        cell: ({ row }) => formatDate(row.original.created_at),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateOrder.isPending, pendingOrderId, deliveringOrderId, deliveryDraft],
  );

  if (orders.isPending) return <TableSkeleton rows={6} cols={6} />;
  if (orders.error) return <ErrorBlock message={extractErrorMessage(orders.error, "Failed to load orders.")} />;
  if (!orders.data?.data.length) {
    return <EmptyBlock title="No orders" description="No orders have been placed yet." />;
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-heading text-3xl font-bold">Admin · Orders</h1>
        <p className="mt-2 text-muted-foreground">
          View every order placed on the platform and update its status. Changing a status to
          &quot;completed&quot; or &quot;failed&quot; notifies the customer. Adding delivery info (a
          license key, PIN, download link, etc.) automatically marks the order completed and emails
          it to the customer.
        </p>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={orders.data.data}
            isFetching={orders.isFetching}
            pagination={{
              page: orders.data.current_page,
              lastPage: orders.data.last_page,
              total: orders.data.total,
              onPageChange: setPage,
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
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
        id: "created",
        header: "Created",
        accessorFn: (row) => row.created_at ?? "",
        cell: ({ row }) => formatDate(row.original.created_at),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateOrder.isPending, pendingOrderId],
  );

  if (orders.isPending) return <TableSkeleton rows={6} cols={5} />;
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
          &quot;completed&quot; or &quot;failed&quot; notifies the customer.
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

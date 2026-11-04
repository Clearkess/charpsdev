"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";

import {
  EmptyBlock,
  ErrorBlock,
  TableSkeleton,
} from "@/components/common/StateBlock";

import {
  useAdminOrderUpdateMutation,
  useAdminOrdersQuery,
} from "@/hooks/queries/useAdminQueries";

import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Order, OrderStatus } from "@/types/api";

const STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
];

function statusVariant(status: string) {
  const normalized = status?.toLowerCase();

  if (normalized === "completed" || normalized === "success") {
    return "success" as const;
  }

  if (normalized === "cancelled" || normalized === "failed") {
    return "destructive" as const;
  }

  if (normalized === "pending") {
    return "warning" as const;
  }

  return "muted" as const;
}

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [deliveringOrderId, setDeliveringOrderId] = useState<number | null>(
    null
  );
  const [deliveryDraft, setDeliveryDraft] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const orders = useAdminOrdersQuery(page);
  const updateOrder = useAdminOrderUpdateMutation();

  const onStatusChange = async (
    order: Order,
    status: OrderStatus
  ) => {
    if (status === order.status) return;

    setMessage(null);
    setPendingOrderId(order.id);

    try {
      const response = await updateOrder.mutateAsync({
        orderId: order.id,
        status,
      });

      setMessage(
        response.message ||
          `Order #${order.id} updated to "${status}".`
      );
    } catch (error) {
      setMessage(
        extractErrorMessage(error, "Failed to update order status.")
      );
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
    if (!deliveryDraft.trim()) return;

    setMessage(null);
    setPendingOrderId(order.id);

    try {
      const response = await updateOrder.mutateAsync({
        orderId: order.id,
        status: "completed",
        delivery_content: deliveryDraft.trim(),
      });

      setMessage(
        response.message ||
          `Delivery information saved for order #${order.id}.`
      );

      setDeliveringOrderId(null);
      setDeliveryDraft("");
    } catch (error) {
      setMessage(
        extractErrorMessage(error, "Failed to save delivery information.")
      );
    } finally {
      setPendingOrderId(null);
    }
  };

  // Search and filter the orders currently loaded from the API.
  const filteredOrders = useMemo(() => {
    const allOrders = orders.data?.data ?? [];
    const search = searchTerm.trim().toLowerCase();

    return allOrders.filter((order) => {
      const serviceName =
        (order.details as { service_name?: string } | null)
          ?.service_name ||
        order.service?.name ||
        "";

      const searchableText = [
        order.reference ?? "",
        order.id,
        order.user?.name ?? "",
        order.user?.email ?? "",
        serviceName,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search || searchableText.includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        order.status?.toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders.data?.data, searchTerm, statusFilter]);

  const columns = useMemo<ColumnDef<Order, unknown>[]>(
    () => [
      {
        id: "reference",
        header: "Order",
        accessorFn: (row) => row.reference || `#${row.id}`,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.reference || `#${row.original.id}`}
            </div>
            <div className="text-xs text-muted-foreground">
              {(row.original.details as {
                service_name?: string;
              } | null)?.service_name ||
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
            <div className="font-medium">
              {row.original.user?.name || "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.user?.email || "—"}
            </div>
          </div>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessorFn: (row) =>
          Number(row.amount ?? row.price ?? 0),
        cell: ({ row }) =>
          formatCurrency(row.original.amount ?? row.original.price),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.status,
        cell: ({ row }) => {
          const order = row.original;
          const isBusy =
            updateOrder.isPending && pendingOrderId === order.id;

          return (
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(order.status)}>
                {order.status}
              </Badge>

              <select
                value={order.status}
                disabled={isBusy}
                onChange={(event) =>
                  void onStatusChange(
                    order,
                    event.target.value as OrderStatus
                  )
                }
                aria-label={`Update status for order ${
                  order.reference || order.id
                }`}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs disabled:opacity-50"
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
          const isBusy =
            updateOrder.isPending && pendingOrderId === order.id;

          if (deliveringOrderId === order.id) {
            return (
              <div className="w-64 space-y-2">
                <textarea
                  value={deliveryDraft}
                  onChange={(event) =>
                    setDeliveryDraft(event.target.value)
                  }
                  placeholder="License key, PIN, download link or delivery details..."
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                />

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={isBusy || !deliveryDraft.trim()}
                    onClick={() => void saveDelivery(order)}
                  >
                    {isBusy ? "Sending..." : "Save & notify"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelDelivery}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-2">
              {order.delivery_content ? (
                <p
                  className="max-w-[220px] truncate font-mono text-xs text-muted-foreground"
                  title={order.delivery_content}
                >
                  {order.delivery_content}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Not delivered yet
                </p>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => startDelivery(order)}
              >
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
    [
      updateOrder.isPending,
      pendingOrderId,
      deliveringOrderId,
      deliveryDraft,
    ]
  );

  if (orders.isPending) {
    return <TableSkeleton rows={6} cols={6} />;
  }

  if (orders.error) {
    return (
      <ErrorBlock
        message={extractErrorMessage(
          orders.error,
          "Failed to load orders."
        )}
      />
    );
  }

  if (!orders.data?.data.length) {
    return (
      <EmptyBlock
        title="No orders"
        description="No orders have been placed yet."
      />
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-heading text-3xl font-bold">
          Admin · Orders
        </h1>

        <p className="mt-2 text-muted-foreground">
          View every order placed on the platform and update its status.
          Changing a status to completed or failed notifies the customer.
          Adding delivery information automatically marks the order
          completed and emails it to the customer.
        </p>
      </div>

      {message && (
        <div
          role="status"
          className="rounded-lg border border-border bg-muted p-3 text-sm"
        >
          {message}
        </div>
      )}

      {/* Search and status filters */}
      <Card>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="order-search"
                className="text-sm font-medium"
              >
                Search orders
              </label>

              <input
                id="order-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Reference, customer, email or service..."
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="order-status-filter"
                className="text-sm font-medium"
              >
                Filter by status
              </label>

              <select
                id="order-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="all">All statuses</option>

                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {filteredOrders.length} of {orders.data.data.length}{" "}
              orders on this page
            </p>

            {(searchTerm || statusFilter !== "all") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* No matching orders */}
      {filteredOrders.length === 0 && (
        <EmptyBlock
          title="No matching orders"
          description="Try another search term or change the status filter."
        />
      )}

      {/* Mobile-friendly order cards */}
      {filteredOrders.length > 0 && (
        <div className="space-y-3 md:hidden">
          {filteredOrders.map((order) => {
            const isBusy =
              updateOrder.isPending && pendingOrderId === order.id;

            return (
              <Card key={order.id}>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {order.reference || `#${order.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.user?.name || "Customer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.user?.email || ""}
                      </p>
                    </div>

                    <Badge variant={statusVariant(order.status)}>
                      {order.status}
                    </Badge>
                  </div>

                  <div className="text-lg font-bold">
                    {formatCurrency(order.amount ?? order.price)}
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor={`status-${order.id}`}
                      className="text-sm font-medium"
                    >
                      Update order status
                    </label>

                    <select
                      id={`status-${order.id}`}
                      value={order.status}
                      disabled={isBusy}
                      onChange={(event) =>
                        void onStatusChange(
                          order,
                          event.target.value as OrderStatus
                        )
                      }
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Delivery information
                    </p>

                    {deliveringOrderId === order.id ? (
                      <>
                        <textarea
                          value={deliveryDraft}
                          onChange={(event) =>
                            setDeliveryDraft(event.target.value)
                          }
                          placeholder="Enter license key, PIN, download link or delivery details..."
                          rows={4}
                          className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                        />

                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            disabled={isBusy || !deliveryDraft.trim()}
                            onClick={() => void saveDelivery(order)}
                          >
                            {isBusy ? "Sending..." : "Save & notify"}
                          </Button>

                          <Button
                            variant="outline"
                            onClick={cancelDelivery}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="break-words text-xs text-muted-foreground">
                          {order.delivery_content || "Not delivered yet"}
                        </p>

                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => startDelivery(order)}
                        >
                          {order.delivery_content
                            ? "Edit delivery information"
                            : "Add delivery information"}
                        </Button>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Created: {formatDate(order.created_at)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Desktop orders table */}
      {filteredOrders.length > 0 && (
        <div className="hidden md:block">
          <Card>
            <CardContent>
              <DataTable
                columns={columns}
                data={filteredOrders}
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
        </div>
      )}
    </section>
  );
}

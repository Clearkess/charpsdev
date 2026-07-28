"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useCreateOrderMutation, useOrdersQuery } from "@/hooks/queries/useOrdersQueries";
import { useServicesQuery } from "@/hooks/queries/useServicesQuery";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

function statusVariant(status: string) {
  const normalized = status?.toLowerCase();
  if (normalized === "completed" || normalized === "success") return "success" as const;
  if (normalized === "cancelled" || normalized === "failed") return "destructive" as const;
  if (normalized === "pending") return "warning" as const;
  return "muted" as const;
}

export default function OrdersPage() {
  const orders = useOrdersQuery();
  const services = useServicesQuery();
  const createOrder = useCreateOrderMutation();
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState<string | null>(null);

  const firstServiceId = useMemo(() => services.data?.[0]?.id?.toString() || "", [services.data]);
  const selectedServiceId = serviceId || firstServiceId;

  if (orders.isPending || services.isPending) return <TableSkeleton rows={4} cols={5} />;
  if (orders.error || services.error) {
    return <ErrorBlock message={extractErrorMessage(orders.error || services.error, "Order request failed.")} />;
  }

  const onCreateOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedServiceId) return;
    setMessage(null);
    try {
      const response = await createOrder.mutateAsync({ service_id: Number(selectedServiceId), quantity: Number(quantity) });
      setMessage(response.message || `Order #${response.data.id} created.`);
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to create order."));
    }
  };

  const rows = orders.data?.data || [];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Orders</h1>
        <p className="mt-2 text-muted-foreground">Create new orders and track their status.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create order</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreateOrder} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={selectedServiceId}
                onChange={(e) => setServiceId(e.target.value)}
                aria-label="Service"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {services.data?.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <Input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="Quantity" />
            </div>
            <Button type="submit" disabled={createOrder.isPending || !selectedServiceId}>
              {createOrder.isPending ? "Creating..." : "Create order"}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </form>
        </CardContent>
      </Card>
      {!rows.length ? (
        <EmptyBlock title="No orders" description="Orders you place will show up here." />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>#{order.id}</TableCell>
                    <TableCell>{order.service?.name || order.service_id || "—"}</TableCell>
                    <TableCell>{order.quantity ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(order.amount ?? order.price ?? 0)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(order.status)} className="capitalize">
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(order.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

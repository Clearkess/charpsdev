"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageCheckIcon, RepeatIcon, ShoppingCartIcon, StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import ReviewFormRow from "@/components/common/ReviewFormRow";
import { useAddToCartMutation } from "@/hooks/queries/useCartQueries";
import { useCreateOrderMutation, useOrdersQuery } from "@/hooks/queries/useOrdersQueries";
import { useServicesQuery } from "@/hooks/queries/useServicesQuery";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Order } from "@/types/api";

function statusVariant(status: string) {
  const normalized = status?.toLowerCase();
  if (normalized === "completed" || normalized === "success") return "success" as const;
  if (normalized === "cancelled" || normalized === "failed") return "destructive" as const;
  if (normalized === "pending") return "warning" as const;
  return "muted" as const;
}

/** Every service_id + quantity line in an order, regardless of shape (cart-checkout `items` vs legacy single-service). */
function orderLines(order: Order): Array<{ service_id: number; quantity: number; name: string }> {
  if (order.items?.length) {
    return order.items.map((item) => ({
      service_id: item.service_id,
      quantity: item.quantity,
      name: item.service?.name || `#${item.service_id}`,
    }));
  }
  if (order.service_id) {
    return [{ service_id: order.service_id, quantity: order.quantity ?? 1, name: order.service?.name || `#${order.service_id}` }];
  }
  return [];
}

export default function OrdersPage() {
  const router = useRouter();
  const orders = useOrdersQuery();
  const services = useServicesQuery();
  const createOrder = useCreateOrderMutation();
  const addToCart = useAddToCartMutation();
  const searchParams = useSearchParams();
  const placedOrderId = searchParams.get("placed");
  const highlightRef = searchParams.get("ref");
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState<string | null>(null);
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<number>>(new Set());
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<number>>(new Set());
  const [reorderState, setReorderState] = useState<Record<number, string>>({});
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  const toggleDelivery = (orderId: number) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleReview = (orderId: number) => {
    setExpandedReviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  /**
   * Phase 9 (user-facing features): "Buy again" — re-adds every line from a
   * past order to the cart at today's price/stock (sequential, so a
   * mid-loop stock failure on one line still leaves the earlier lines added
   * rather than silently losing them), then jumps to the Cart page. No new
   * backend endpoint needed — this just replays existing `POST /api/cart`
   * calls the same way manually adding each item would.
   */
  const onReorder = async (order: Order) => {
    const lines = orderLines(order);
    if (!lines.length) return;
    setReorderingId(order.id);
    setReorderState((prev) => ({ ...prev, [order.id]: "" }));
    try {
      for (const line of lines) {
        await addToCart.mutateAsync({ service_id: line.service_id, quantity: line.quantity });
      }
      router.push("/cart");
    } catch (error) {
      setReorderState((prev) => ({ ...prev, [order.id]: extractErrorMessage(error, "Failed to reorder.") }));
    } finally {
      setReorderingId(null);
    }
  };

  useEffect(() => {
    if (highlightRef && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Re-run once `orders.data` finishes loading (the row/ref doesn't exist
    // until the table has actually rendered past the loading skeleton).
  }, [highlightRef, orders.data]);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">Orders</h1>
          <p className="mt-2 text-muted-foreground">Create new orders and track their status.</p>
        </div>
        <Button render={<Link href="/cart" />} variant="outline" size="sm">
          <ShoppingCartIcon data-icon="inline-start" aria-hidden="true" />
          View cart
        </Button>
      </div>
      {placedOrderId ? (
        <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success">
          Order #{placedOrderId} placed successfully via checkout.
        </div>
      ) : null}
      {highlightRef ? (
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
          Showing order <span className="font-mono font-medium">{highlightRef}</span> from your wallet transaction, highlighted below.
        </div>
      ) : null}
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
        <EmptyBlock
          title="No orders yet"
          description="Create your first order above, or browse the marketplace to see what's available."
          icon={ShoppingCartIcon}
          action={
            <Button render={<Link href="/services" prefetch={false} />} variant="outline" size="sm">
              Browse services
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Item(s)</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((order) => {
                  const itemNames = order.items?.length
                    ? order.items.map((item) => item.service?.name || `#${item.service_id}`).join(", ")
                    : order.service?.name || order.service_id || "—";
                  const totalQuantity = order.items?.length
                    ? order.items.reduce((sum, item) => sum + item.quantity, 0)
                    : (order.quantity ?? "—");
                  const isHighlighted = Boolean(highlightRef) && (order.reference === highlightRef || order.order_number === highlightRef);
                  const hasDelivery = Boolean(order.delivery_content);
                  const isExpanded = expandedOrderIds.has(order.id);
                  const isCompleted = order.status === "completed";
                  const isReviewExpanded = expandedReviewIds.has(order.id);
                  const lines = orderLines(order);
                  const reorderError = reorderState[order.id];
                  return (
                    <>
                      <TableRow
                        key={order.id}
                        ref={isHighlighted ? highlightedRowRef : undefined}
                        className={cn(isHighlighted && "bg-primary/10 outline outline-2 -outline-offset-2 outline-primary/40")}
                      >
                        <TableCell>{order.order_number || `#${order.id}`}</TableCell>
                        <TableCell className="max-w-xs truncate">{itemNames}</TableCell>
                        <TableCell>{totalQuantity}</TableCell>
                        <TableCell>
                          {formatCurrency(order.total ?? order.amount ?? order.price ?? 0)}
                          {order.coupon_code ? (
                            <span className="mt-0.5 block text-xs text-primary">
                              {order.coupon_code} · -{formatCurrency(order.discount ?? 0)}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(order.status)} className="capitalize">
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hasDelivery ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleDelivery(order.id)}
                            >
                              <PackageCheckIcon data-icon="inline-start" aria-hidden="true" />
                              {isExpanded ? "Hide" : "View"}
                            </Button>
                          ) : order.status === "completed" ? (
                            <span className="text-xs text-muted-foreground">No details</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(order.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1.5">
                            {lines.length ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={reorderingId === order.id}
                                onClick={() => onReorder(order)}
                              >
                                <RepeatIcon data-icon="inline-start" aria-hidden="true" />
                                {reorderingId === order.id ? "Adding..." : "Buy again"}
                              </Button>
                            ) : null}
                            {isCompleted ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => toggleReview(order.id)}
                              >
                                <StarIcon data-icon="inline-start" aria-hidden="true" />
                                {isReviewExpanded ? "Hide review" : "Rate & review"}
                              </Button>
                            ) : null}
                            {reorderError ? <p className="text-xs text-destructive">{reorderError}</p> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasDelivery ? (
                        <TableRow key={`${order.id}-delivery`}>
                          <TableCell colSpan={8} className="bg-muted/40">
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Delivered {order.delivered_at ? formatDate(order.delivered_at) : ""}
                              </p>
                              <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 font-mono text-sm">
                                {order.delivery_content}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {isReviewExpanded && isCompleted ? (
                        <TableRow key={`${order.id}-review`}>
                          <TableCell colSpan={8} className="bg-muted/40">
                            <div className="space-y-2">
                              {lines.map((line) => (
                                <ReviewFormRow key={line.service_id} serviceId={line.service_id} serviceName={line.name} />
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

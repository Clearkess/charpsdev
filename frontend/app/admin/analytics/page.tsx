"use client";

import { useState } from "react";
import {
  BadgePercentIcon,
  BarChart3Icon,
  ReceiptIcon,
  ShoppingCartIcon,
  TicketPercentIcon,
  UserPlusIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock, ErrorBlock, StatCardsSkeleton } from "@/components/common/StateBlock";
import CategoryRevenueChart from "@/components/charts/CategoryRevenueChart";
import SignupsChart from "@/components/charts/SignupsChart";
import { useAdminAnalyticsQuery } from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

const RANGE_OPTIONS = [
  { days: 7 as const, label: "7 days" },
  { days: 30 as const, label: "30 days" },
  { days: 90 as const, label: "90 days" },
  { days: 365 as const, label: "1 year" },
];

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "muted"> = {
  pending: "muted",
  processing: "warning",
  completed: "success",
  failed: "destructive",
  cancelled: "muted",
};

/**
 * Phase 8 (analytics): a dedicated deep-dive page separate from the
 * pre-existing /admin/dashboard (which stays as-is — total counts + a fixed
 * 30-day chart). This page adds a selectable date range, order status
 * breakdown, top services, revenue-by-category, and new-signups over time —
 * none of which existed anywhere in the admin panel before this phase.
 */
export default function AdminAnalyticsPage() {
  const [days, setDays] = useState<7 | 30 | 90 | 365>(30);
  const { data, isPending, error } = useAdminAnalyticsQuery(days);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Analytics</h1>
          <p className="mt-2 text-muted-foreground">
            Order status breakdown, top services, revenue by category, and signups for the selected period.
          </p>
        </div>
        <div className="flex gap-1.5 rounded-full border border-border bg-card p-1">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.days}
              type="button"
              size="sm"
              variant={days === option.days ? "default" : "ghost"}
              className="rounded-full"
              onClick={() => setDays(option.days)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {isPending ? <StatCardsSkeleton count={5} /> : null}
      {error ? <ErrorBlock message={extractErrorMessage(error, "Failed to load analytics.")} /> : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardContent className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Orders in range</p>
                  <p className="mt-2 text-2xl font-semibold">{data.summary.orders_in_range}</p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShoppingCartIcon className="size-4.5" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue in range</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(data.summary.revenue_in_range)}</p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ReceiptIcon className="size-4.5" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Average order value</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(data.summary.average_order_value)}</p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BarChart3Icon className="size-4.5" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">New users</p>
                  <p className="mt-2 text-2xl font-semibold">{data.summary.new_users_in_range}</p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserPlusIcon className="size-4.5" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Coupon discounts given</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(data.coupon_usage.total_discount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{data.coupon_usage.redemptions} redemption(s)</p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TicketPercentIcon className="size-4.5" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Order status breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {data.status_breakdown.map((row) => (
                <div
                  key={row.status}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <Badge variant={STATUS_VARIANT[row.status] ?? "default"} className="capitalize">
                    {row.status}
                  </Badge>
                  <span className="text-lg font-semibold">{row.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>New signups ({data.range_days} days)</CardTitle>
              </CardHeader>
              <CardContent>
                <SignupsChart data={data.signups_series} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by category</CardTitle>
              </CardHeader>
              <CardContent>
                {data.revenue_by_category.length ? (
                  <CategoryRevenueChart data={data.revenue_by_category} />
                ) : (
                  <EmptyBlock
                    title="No revenue yet"
                    description="No completed orders with a service in this period."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgePercentIcon className="size-4" aria-hidden="true" />
                Top services
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.top_services.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.top_services.map((row) => (
                      <TableRow key={row.service_id ?? row.name}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.orders}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(row.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyBlock title="No sales yet" description="No completed orders in this period." />
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}

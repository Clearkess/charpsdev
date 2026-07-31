"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import {
  useAdminCouponCreateMutation,
  useAdminCouponDeleteMutation,
  useAdminCouponsQuery,
  useAdminCouponUpdateMutation,
} from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Coupon, CouponType } from "@/types/api";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default function AdminCouponsPage() {
  const coupons = useAdminCouponsQuery();
  const createCoupon = useAdminCouponCreateMutation();
  const updateCoupon = useAdminCouponUpdateMutation();
  const deleteCoupon = useAdminCouponDeleteMutation();

  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("percentage");
  const [value, setValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!value) return;
    setMessage(null);
    try {
      await createCoupon.mutateAsync({
        code: code.trim() || undefined,
        type,
        value: Number(value),
        min_order_amount: minOrderAmount ? Number(minOrderAmount) : null,
        max_uses: maxUses ? Number(maxUses) : null,
        expires_at: expiresAt || null,
      });
      setCode("");
      setValue("");
      setMinOrderAmount("");
      setMaxUses("");
      setExpiresAt("");
      setMessage("Coupon created.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to create coupon."));
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    setMessage(null);
    try {
      await updateCoupon.mutateAsync({ couponId: coupon.id, active: !coupon.active });
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to update coupon."));
    }
  };

  const onDelete = async (coupon: Coupon) => {
    setMessage(null);
    try {
      await deleteCoupon.mutateAsync(coupon.id);
      setMessage("Coupon deleted.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to delete coupon."));
    }
  };

  const columns = useMemo<ColumnDef<Coupon, unknown>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        accessorFn: (row) => row.code,
        cell: ({ row }) => <span className="font-mono font-medium">{row.original.code}</span>,
      },
      {
        id: "discount",
        header: "Discount",
        accessorFn: (row) => Number(row.value ?? 0),
        cell: ({ row }) =>
          row.original.type === "percentage"
            ? `${Number(row.original.value)}%`
            : formatCurrency(row.original.value),
      },
      {
        id: "min_order",
        header: "Min. order",
        accessorFn: (row) => (row.min_order_amount == null ? -1 : Number(row.min_order_amount)),
        cell: ({ row }) =>
          row.original.min_order_amount == null ? "—" : formatCurrency(row.original.min_order_amount),
      },
      {
        id: "usage",
        header: "Usage",
        accessorFn: (row) => row.used_count,
        cell: ({ row }) => `${row.original.used_count}${row.original.max_uses ? ` / ${row.original.max_uses}` : ""}`,
      },
      {
        id: "expires",
        header: "Expires",
        accessorFn: (row) => row.expires_at ?? "",
        cell: ({ row }) => (row.original.expires_at ? formatDate(row.original.expires_at) : "Never"),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => Boolean(row.active),
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "success" : "muted"}>
            {row.original.active ? "Active" : "Disabled"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const coupon = row.original;
          const isBusy = updateCoupon.isPending && updateCoupon.variables?.couponId === coupon.id;
          const isDeleting = deleteCoupon.isPending && deleteCoupon.variables === coupon.id;
          return (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void toggleActive(coupon)}>
                {isBusy ? "Working..." : coupon.active ? "Disable" : "Enable"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isDeleting}
                className="text-destructive hover:bg-destructive/10"
                onClick={() => void onDelete(coupon)}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateCoupon.isPending, updateCoupon.variables, deleteCoupon.isPending, deleteCoupon.variables],
  );

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Coupons</h1>
      <p className="text-sm text-muted-foreground">
        Discount codes customers can apply at checkout. Leave the code blank to auto-generate one.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Create coupon</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <label className="text-xs text-muted-foreground" htmlFor="coupon-code">Code</label>
              <Input
                id="coupon-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Auto"
                className="uppercase"
              />
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground" htmlFor="coupon-type">Type</label>
              <select
                id="coupon-type"
                value={type}
                onChange={(e) => setType(e.target.value as CouponType)}
                className={selectClassName}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div className="w-28">
              <label className="text-xs text-muted-foreground" htmlFor="coupon-value">
                {type === "percentage" ? "Value (%)" : "Value (₦)"}
              </label>
              <Input
                id="coupon-value"
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground" htmlFor="coupon-min">Min. order</label>
              <Input
                id="coupon-min"
                type="number"
                min="0"
                step="0.01"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="None"
              />
            </div>
            <div className="w-28">
              <label className="text-xs text-muted-foreground" htmlFor="coupon-uses">Max uses</label>
              <Input
                id="coupon-uses"
                type="number"
                min="0"
                step="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <div className="w-44">
              <label className="text-xs text-muted-foreground" htmlFor="coupon-expires">Expires</label>
              <Input
                id="coupon-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={createCoupon.isPending || !value}>
              {createCoupon.isPending ? "Creating..." : "Add coupon"}
            </Button>
          </form>
          {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      {coupons.isPending ? (
        <TableSkeleton rows={5} cols={7} />
      ) : coupons.error ? (
        <ErrorBlock message={extractErrorMessage(coupons.error, "Failed to load coupons.")} />
      ) : !coupons.data?.length ? (
        <EmptyBlock title="No coupons" description="Create your first discount code above." />
      ) : (
        <Card>
          <CardContent>
            <DataTable columns={columns} data={coupons.data} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}

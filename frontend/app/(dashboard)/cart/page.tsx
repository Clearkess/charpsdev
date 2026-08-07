"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, MinusIcon, PlusIcon, ShoppingCartIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import {
  useCartQuery,
  useCheckoutMutation,
  useClearCartMutation,
  useRemoveCartItemMutation,
  useUpdateCartItemMutation,
  useValidateCouponMutation,
} from "@/hooks/queries/useCartQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { CouponPreview } from "@/types/api";

export default function CartPage() {
  const cart = useCartQuery();
  const updateItem = useUpdateCartItemMutation();
  const removeItem = useRemoveCartItemMutation();
  const clearCart = useClearCartMutation();
  const checkout = useCheckoutMutation();
  const validateCoupon = useValidateCouponMutation();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  if (cart.isPending) return <TableSkeleton rows={3} cols={4} />;
  if (cart.error) return <ErrorBlock message={extractErrorMessage(cart.error, "Failed to load cart.")} />;

  const items = cart.data?.data || [];
  const total = cart.data?.total ?? 0;

  const changeQuantity = async (cartItemId: number, quantity: number) => {
    if (quantity < 1) return;
    setError(null);
    try {
      await updateItem.mutateAsync({ cartItemId, quantity });
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to update quantity."));
    }
  };

  const onRemove = async (cartItemId: number) => {
    setError(null);
    try {
      await removeItem.mutateAsync(cartItemId);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to remove item."));
    }
  };

  const onApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponError(null);
    try {
      const preview = await validateCoupon.mutateAsync({ code: couponInput.trim(), subtotal: total });
      setAppliedCoupon(preview);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(extractErrorMessage(err, "Invalid or expired coupon code."));
    }
  };

  const onRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponInput("");
  };

  const onCheckout = async () => {
    setError(null);
    try {
      const response = await checkout.mutateAsync(
        appliedCoupon ? { coupon_code: appliedCoupon.code } : undefined,
      );
      router.push(`/orders?placed=${response.data.id}`);
    } catch (err) {
      // The coupon may have been exhausted/expired between the preview and
      // this request (CheckoutController re-validates it authoritatively
      // inside its own transaction) — surface that distinctly so the user
      // knows to remove/retry the coupon rather than assume a generic failure.
      setError(extractErrorMessage(err, "Checkout failed. Please try again."));
    }
  };

  const discount = appliedCoupon?.discount ?? 0;
  const totalAfterDiscount = appliedCoupon?.total_after_discount ?? total;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Cart</h1>
        <p className="mt-2 text-muted-foreground">Review your items before checking out.</p>
      </div>

      {error ? <ErrorBlock message={error} /> : null}

      {!items.length ? (
        <EmptyBlock
          title="Your cart is empty"
          description="Browse the marketplace and add a service or product to get started."
          icon={ShoppingCartIcon}
          action={
            <Button render={<Link href="/services" prefetch={false} />} variant="outline" size="sm">
              Browse services
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.service?.name || `Service #${item.service_id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.service?.price ?? 0, item.service?.currency)} each
                    {item.service?.stock != null ? ` · ${item.service.stock} in stock` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Decrease quantity"
                    disabled={updateItem.isPending || item.quantity <= 1}
                    onClick={() => void changeQuantity(item.id, item.quantity - 1)}
                  >
                    <MinusIcon />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Increase quantity"
                    disabled={updateItem.isPending}
                    onClick={() => void changeQuantity(item.id, item.quantity + 1)}
                  >
                    <PlusIcon />
                  </Button>
                </div>
                <p className="w-28 text-right font-semibold">{formatCurrency(item.subtotal ?? 0)}</p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove item"
                  disabled={removeItem.isPending}
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => void onRemove(item.id)}
                >
                  <Trash2Icon />
                </Button>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="coupon-code">
                  Coupon code
                </label>
                {appliedCoupon ? (
                  <div className="mt-1 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 font-medium text-primary">
                      <CheckCircle2Icon className="size-4" aria-hidden="true" />
                      {appliedCoupon.code} applied
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove coupon" onClick={onRemoveCoupon}>
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="coupon-code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="e.g. SAVE500"
                      className="uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={validateCoupon.isPending || !couponInput.trim()}
                      onClick={() => void onApplyCoupon()}
                    >
                      {validateCoupon.isPending ? "Checking..." : "Apply"}
                    </Button>
                  </div>
                )}
                {couponError ? <p className="mt-1.5 text-xs text-destructive">{couponError}</p> : null}
              </div>

              <div className="space-y-1.5 border-t border-border pt-3 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between text-primary">
                    <span>Discount ({appliedCoupon.code})</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between pt-1 text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(totalAfterDiscount)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between gap-3">
              <Button
                variant="outline"
                disabled={clearCart.isPending}
                onClick={() => void clearCart.mutateAsync()}
              >
                Clear cart
              </Button>
              <Button disabled={checkout.isPending} onClick={() => void onCheckout()}>
                {checkout.isPending ? "Placing order..." : "Checkout"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </section>
  );
}

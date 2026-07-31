"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { CartResponse, CouponPreview, Order } from "@/types/api";

export function useCartQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.cart,
    queryFn: async () => {
      const response = await api.get<CartResponse>("/cart");
      return response.data;
    },
    enabled: isAuthenticated,
  });
}

export function useAddToCartMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ service_id, quantity = 1 }: { service_id: number; quantity?: number }) => {
      const response = await api.post<CartResponse & { message: string }>("/cart", { service_id, quantity });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}

export function useUpdateCartItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cartItemId, quantity }: { cartItemId: number; quantity: number }) => {
      const response = await api.put(`/cart/${cartItemId}`, { quantity });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}

export function useRemoveCartItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cartItemId: number) => {
      const response = await api.delete(`/cart/${cartItemId}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}

export function useClearCartMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.delete("/cart");
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}

export function useCheckoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    // Phase 4: optional coupon_code, applied server-side inside the same
    // atomic checkout transaction (see CheckoutController).
    mutationFn: async (payload?: { coupon_code?: string }) => {
      const response = await api.post<{ success: boolean; message: string; data: Order }>(
        "/checkout",
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      void queryClient.invalidateQueries({ queryKey: queryKeys.walletTransactions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    },
  });
}

/**
 * Read-only coupon preview for the Cart page — shows the discount amount
 * before the user commits to checkout. Does not consume the coupon; the
 * only authoritative validation + redemption happens inside
 * CheckoutController's own DB transaction, so this preview passing is not
 * a guarantee the checkout itself will succeed (e.g. a limited-use coupon
 * could be exhausted by someone else in between).
 */
export function useValidateCouponMutation() {
  return useMutation({
    mutationFn: async ({ code, subtotal }: { code: string; subtotal: number }) => {
      const response = await api.post<{ success: boolean; data: CouponPreview }>("/coupons/validate", {
        code,
        subtotal,
      });
      return response.data.data;
    },
  });
}

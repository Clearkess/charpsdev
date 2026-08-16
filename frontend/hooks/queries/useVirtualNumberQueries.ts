"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type {
  ApiResponse,
  PaginatedResponse,
  VirtualNumberCountry,
  VirtualNumberOrder,
  VirtualNumberProviderOption,
  VirtualNumberServiceOption,
} from "@/types/api";

/**
 * Active, credentialed providers for this feature (provider-scoped
 * browsing: pick one of these first). `GET /virtual-numbers/providers`
 * is a public, read-only DB lookup with no third-party cost (see backend
 * routes/api.php — Top-3-Fixes Fix 2), so this fetches regardless of
 * auth state to support the public `/virtual-numbers` teaser. Country
 * and service lookups below stay auth-gated since they hit live, paid
 * 3rd-party APIs.
 */
export function useVirtualProvidersQuery() {
  return useQuery({
    queryKey: queryKeys.virtualNumberProviders,
    queryFn: async () => {
      const response = await api.get<ApiResponse<VirtualNumberProviderOption[]>>("/virtual-numbers/providers");
      return response.data.data;
    },
  });
}

export function useVirtualCountriesQuery(provider: string | null) {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.virtualNumberCountries(provider ?? ""),
    queryFn: async () => {
      const response = await api.get<ApiResponse<VirtualNumberCountry[]>>(`/virtual-numbers/${provider}/countries`);
      return response.data.data;
    },
    enabled: isAuthenticated && Boolean(provider),
    staleTime: 5 * 60 * 1000,
  });
}

export function useVirtualServicesQuery(provider: string | null, country: string | null) {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.virtualNumberServices(provider ?? "", country ?? ""),
    queryFn: async () => {
      const response = await api.get<ApiResponse<VirtualNumberServiceOption[]>>(`/virtual-numbers/${provider}/services`, {
        params: { country },
      });
      return response.data.data;
    },
    enabled: isAuthenticated && Boolean(provider) && Boolean(country),
    staleTime: 60 * 1000,
  });
}

export function useVirtualNumberOrdersQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.virtualNumberOrders,
    queryFn: async () => {
      const response = await api.get<ApiResponse<PaginatedResponse<VirtualNumberOrder>>>("/virtual-numbers/orders");
      return response.data.data;
    },
    enabled: isAuthenticated,
    // Active orders (waiting_code) are worth refreshing periodically so
    // the SMS code shows up without the customer manually hitting
    // "Refresh" on every order — cheap since this just reads our own DB,
    // no provider call (that only happens via the dedicated poll mutation).
    refetchInterval: (query) => {
      const hasActive = query.state.data?.data.some((order) => order.status === "pending" || order.status === "waiting_code");
      return hasActive ? 10_000 : false;
    },
  });
}

export function useBuyVirtualNumberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { provider: string; country: string; service: string }) => {
      const response = await api.post<ApiResponse<VirtualNumberOrder>>("/virtual-numbers/orders", payload);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.virtualNumberOrders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

/** Polls the provider once for this order's SMS code / terminal status. */
export function usePollVirtualNumberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: number) => {
      const response = await api.post<ApiResponse<VirtualNumberOrder>>(`/virtual-numbers/orders/${orderId}/poll`);
      return response.data.data;
    },
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.virtualNumberOrders });
      if (order.status === "refunded") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      }
    },
  });
}

export function useCancelVirtualNumberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: number) => {
      const response = await api.post<ApiResponse<VirtualNumberOrder>>(`/virtual-numbers/orders/${orderId}/cancel`);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.virtualNumberOrders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

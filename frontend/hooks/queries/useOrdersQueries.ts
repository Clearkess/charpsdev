"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { ApiResponse, Order, PaginatedResponse } from "@/types/api";

export function useOrdersQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.orders,
    queryFn: async () => {
      const response = await api.get<ApiResponse<PaginatedResponse<Order>>>("/orders");
      return response.data.data;
    },
    enabled: isAuthenticated,
  });
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ service_id, quantity }: { service_id: number; quantity: number }) => {
      const response = await api.post<ApiResponse<Order>>("/orders", { service_id, quantity });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    },
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { ApiResponse, PaginatedResponse, PaymentInitializeResponse, Transaction, Wallet } from "@/types/api";

export function useWalletQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: async () => {
      const response = await api.get<ApiResponse<Wallet>>("/wallet");
      return response.data.data;
    },
    enabled: isAuthenticated,
  });
}

export function useWalletTransactionsQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.walletTransactions,
    queryFn: async () => {
      const response = await api.get<ApiResponse<PaginatedResponse<Transaction>>>("/wallet/transactions");
      return response.data.data;
    },
    enabled: isAuthenticated,
  });
}

export function useInitializePaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amount: number) => {
      const response = await api.post<PaymentInitializeResponse>("/payment/initialize", { amount });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      void queryClient.invalidateQueries({ queryKey: queryKeys.walletTransactions });
    },
  });
}

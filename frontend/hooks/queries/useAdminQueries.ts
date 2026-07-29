"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type {
  ChartDataPoint,
  DashboardStats,
  Order,
  OrderStatus,
  PaginatedResponse,
  Service,
  SimpleMessageResponse,
  User,
  WalletListItem,
} from "@/types/api";

function useIsAdmin() {
  return useAuthStore((state) => Boolean(state.user?.is_admin && state.token));
}

export function useAdminDashboardQuery() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminDashboard,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: DashboardStats }>("/admin/dashboard");
      return response.data.data;
    },
    enabled: isAdmin,
  });
}

export function useAdminDashboardChartQuery() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminDashboardChart,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: ChartDataPoint[] }>(
        "/admin/dashboard/chart-data",
      );
      return response.data.data;
    },
    enabled: isAdmin,
  });
}

export function useAdminUsersQuery() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; users: User[] }>("/admin/users");
      return response.data.users;
    },
    enabled: isAdmin,
  });
}

export function useAdminServicesQuery() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminServices,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; services: Service[] }>("/admin/services");
      return response.data.services;
    },
    enabled: isAdmin,
  });
}

export function useAdminWalletsQuery() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminWallets,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; wallets: WalletListItem[] }>("/admin/wallets");
      return response.data.wallets;
    },
    enabled: isAdmin,
  });
}

export function useAdminOrdersQuery(page: number = 1) {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminOrders(page),
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: PaginatedResponse<Order> }>(
        "/admin/orders",
        { params: { page } },
      );
      return response.data.data;
    },
    enabled: isAdmin,
    placeholderData: keepPreviousData,
  });
}

export function useAdminOrderUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      provider_reference,
    }: {
      orderId: number;
      status: OrderStatus;
      provider_reference?: string;
    }) => {
      const response = await api.put<{ success: boolean; message: string; data: Order }>(
        `/admin/orders/${orderId}`,
        { status, provider_reference },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboardChart });
    },
  });
}

export function useAdminUserActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, action }: { userId: number; action: "activate" | "suspend" }) => {
      const response = await api.post<SimpleMessageResponse>(`/admin/users/${userId}/${action}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
    },
  });
}

export function useAdminWalletActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, action, amount }: { userId: number; action: "credit" | "debit"; amount: number }) => {
      const response = await api.post<{ success: boolean; balance: number | string; message?: string }>(
        `/admin/wallets/${userId}/${action}`,
        { amount },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminWallets });
    },
  });
}

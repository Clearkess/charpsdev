"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type {
  Category,
  ChartDataPoint,
  DashboardStats,
  Order,
  OrderStatus,
  PaginatedResponse,
  Service,
  SimpleMessageResponse,
  Transaction,
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

export interface AdminServicePayload {
  name: string;
  category_id?: number | null;
  description?: string | null;
  price: number;
  currency?: string;
  stock?: number | null;
  provider_id?: number | null;
  active?: boolean;
}

export function useAdminServiceCreateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AdminServicePayload) => {
      const response = await api.post<{ success: boolean; message: string; service: Service }>(
        "/admin/services",
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminServices });
      void queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useAdminServiceUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serviceId, ...payload }: Partial<AdminServicePayload> & { serviceId: number }) => {
      const response = await api.put<{ success: boolean; message: string; service: Service }>(
        `/admin/services/${serviceId}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminServices });
      void queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useAdminServiceDeleteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serviceId: number) => {
      const response = await api.delete<SimpleMessageResponse>(`/admin/services/${serviceId}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminServices });
      void queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useAdminCategoriesQuery() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminCategories,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Category[] }>("/admin/categories");
      return response.data.data;
    },
    enabled: isAdmin,
  });
}

export interface AdminCategoryPayload {
  name: string;
  icon?: string | null;
  status?: boolean;
  sort_order?: number;
}

export function useAdminCategoryCreateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AdminCategoryPayload) => {
      const response = await api.post<{ success: boolean; message: string; data: Category }>(
        "/admin/categories",
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

export function useAdminCategoryUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, ...payload }: Partial<AdminCategoryPayload> & { categoryId: number }) => {
      const response = await api.put<{ success: boolean; message: string; data: Category }>(
        `/admin/categories/${categoryId}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

export function useAdminCategoryDeleteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: number) => {
      const response = await api.delete<SimpleMessageResponse>(`/admin/categories/${categoryId}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
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
    mutationFn: async ({
      userId,
      action,
      amount,
      reason,
    }: {
      userId: number;
      action: "credit" | "debit";
      amount: number;
      reason?: string;
    }) => {
      const response = await api.post<{ success: boolean; balance: number | string; message?: string }>(
        `/admin/wallets/${userId}/${action}`,
        { amount, reason },
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminWallets });
      void queryClient.invalidateQueries({ queryKey: ["admin", "wallets", variables.userId, "transactions"] });
    },
  });
}

/**
 * Phase 2 (Wallet Refinements): per-user transaction drill-down for the
 * admin wallets page, backed by GET /admin/wallets/{user}/transactions
 * (reads the same `transactions` table the user's own Wallet page reads,
 * so what an admin sees for a user matches what that user sees for
 * themselves).
 */
export function useAdminWalletTransactionsQuery(userId: number | null, page: number = 1) {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminWalletTransactions(userId ?? 0, page),
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: PaginatedResponse<Transaction> }>(
        `/admin/wallets/${userId}/transactions`,
        { params: { page } },
      );
      return response.data.data;
    },
    enabled: isAdmin && userId !== null,
    placeholderData: keepPreviousData,
  });
}

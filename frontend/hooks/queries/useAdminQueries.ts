"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type {
  AnalyticsOverview,
  Category,
  ChartDataPoint,
  Coupon,
  CouponType,
  DashboardStats,
  Order,
  OrderStatus,
  PaginatedResponse,
  Provider,
  ProviderHealthCheck,
  Service,
  ServiceProviderRoute,
  Setting,
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

/**
 * Phase 8 (analytics): powers the dedicated /admin/analytics page, separate
 * from the pre-existing (already-in-production) useAdminDashboardQuery /
 * useAdminDashboardChartQuery above. `days` defaults to 30 and must be one
 * of 7/30/90/365 (enforced server-side too); `keepPreviousData` avoids a
 * loading flash when the admin switches the range selector.
 */
export function useAdminAnalyticsQuery(days: 7 | 30 | 90 | 365 = 30) {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminAnalytics(days),
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: AnalyticsOverview }>(
        "/admin/analytics/overview",
        { params: { days } },
      );
      return response.data.data;
    },
    enabled: isAdmin,
    placeholderData: keepPreviousData,
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
      delivery_content,
    }: {
      orderId: number;
      status: OrderStatus;
      provider_reference?: string;
      /** Phase 5: sending this alongside status "completed" triggers a delivery email. */
      delivery_content?: string;
    }) => {
      const response = await api.put<{ success: boolean; message: string; data: Order }>(
        `/admin/orders/${orderId}`,
        { status, provider_reference, delivery_content },
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

/* ------------------------------------------------------------------ */
/* Phase 4 — Providers / Coupons / Settings admin pages                */
/* ------------------------------------------------------------------ */

export function useAdminProvidersQuery() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminProviders,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Provider[] }>("/admin/providers");
      return response.data.data;
    },
    enabled: isAdmin,
  });
}

export interface AdminProviderPayload {
  name: string;
  base_url: string;
  api_key?: string;
  active?: boolean;
}

export function useAdminProviderCreateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AdminProviderPayload) => {
      const response = await api.post<{ success: boolean; message: string; data: Provider }>(
        "/admin/providers",
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminProviders });
    },
  });
}

export function useAdminProviderUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ providerId, ...payload }: Partial<AdminProviderPayload> & { providerId: number }) => {
      const response = await api.put<{ success: boolean; message: string; data: Provider }>(
        `/admin/providers/${providerId}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminProviders });
    },
  });
}

export function useAdminProviderDeleteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (providerId: number) => {
      const response = await api.delete<SimpleMessageResponse>(`/admin/providers/${providerId}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminProviders });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Provider Router (Option B) — provider health + per-service routing  */
/* ------------------------------------------------------------------ */

export interface ProviderHealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  offline: number;
}

/** Powers the Providers page's "Provider Health summary panel". */
export function useAdminProviderHealthSummaryQuery() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminProviderHealthSummary,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: ProviderHealthSummary }>(
        "/admin/providers/health-summary",
      );
      return response.data.data;
    },
    enabled: isAdmin,
  });
}

/**
 * POST /admin/providers/{id}/test — read-only connectivity/credential
 * check (adapter's ping()). Does NOT affect health_status/cooldown, so it
 * intentionally does not invalidate adminProviders.
 */
export function useAdminProviderTestMutation() {
  return useMutation({
    mutationFn: async (providerId: number) => {
      const response = await api.post<{
        success: boolean;
        data: { ok: boolean; message: string; is_real_adapter: boolean };
      }>(`/admin/providers/${providerId}/test`);
      return response.data.data;
    },
  });
}

/**
 * POST /admin/providers/{id}/health-check — an active synthetic check that
 * DOES affect health_status/cooldown/counters exactly like a real
 * fulfilment attempt would, so this invalidates both the provider list and
 * the health summary panel.
 */
export function useAdminProviderHealthCheckMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (providerId: number) => {
      const response = await api.post<{ success: boolean; message: string; data: Provider }>(
        `/admin/providers/${providerId}/health-check`,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminProviders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminProviderHealthSummary });
    },
  });
}

/** GET /admin/providers/{id}/health — recent health-check history for a drill-down view. */
export function useAdminProviderHealthQuery(providerId: number | null) {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminProviderHealth(providerId ?? 0),
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: { provider: Provider; checks: ProviderHealthCheck[] };
      }>(`/admin/providers/${providerId}/health`);
      return response.data.data;
    },
    enabled: isAdmin && providerId !== null,
  });
}

/**
 * GET /admin/services/{service}/providers — the per-service routing chain
 * that backs the "Routing editor" UI, in ProviderRouter's exact try-order.
 */
export function useAdminServiceProvidersQuery(serviceId: number | null) {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminServiceProviders(serviceId ?? 0),
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: ServiceProviderRoute[] }>(
        `/admin/services/${serviceId}/providers`,
      );
      return response.data.data;
    },
    enabled: isAdmin && serviceId !== null,
  });
}

export interface AdminServiceProviderRoutePayload {
  provider_id: number;
  priority?: number;
  enabled?: boolean;
  provider_service_id?: string | null;
  provider_cost?: number | null;
}

/** POST /admin/services/{service}/providers — "+ Add provider". */
export function useAdminServiceProviderCreateMutation(serviceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AdminServiceProviderRoutePayload) => {
      const response = await api.post<{ success: boolean; message: string; data: ServiceProviderRoute }>(
        `/admin/services/${serviceId}/providers`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminServiceProviders(serviceId) });
    },
  });
}

/** PUT /admin/services/{service}/providers/{route} — edit priority/enabled/etc. */
export function useAdminServiceProviderUpdateMutation(serviceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      routeId,
      ...payload
    }: Partial<Omit<AdminServiceProviderRoutePayload, "provider_id">> & { routeId: number }) => {
      const response = await api.put<{ success: boolean; message: string; data: ServiceProviderRoute }>(
        `/admin/services/${serviceId}/providers/${routeId}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminServiceProviders(serviceId) });
    },
  });
}

/** DELETE /admin/services/{service}/providers/{route} — remove from chain. */
export function useAdminServiceProviderDeleteMutation(serviceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (routeId: number) => {
      const response = await api.delete<SimpleMessageResponse>(`/admin/services/${serviceId}/providers/${routeId}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminServiceProviders(serviceId) });
    },
  });
}

/**
 * POST /admin/services/{service}/providers/reorder — the "Save routing" /
 * drag-to-reorder action. Sends the full desired order as route IDs; the
 * backend rewrites priority for every one of them in that order.
 */
export function useAdminServiceProviderReorderMutation(serviceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (routeIds: number[]) => {
      const response = await api.post<{ success: boolean; message: string; data: ServiceProviderRoute[] }>(
        `/admin/services/${serviceId}/providers/reorder`,
        { route_ids: routeIds },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminServiceProviders(serviceId) });
    },
  });
}

export function useAdminCouponsQuery() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminCoupons,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Coupon[] }>("/admin/coupons");
      return response.data.data;
    },
    enabled: isAdmin,
  });
}

export interface AdminCouponPayload {
  code?: string;
  type: CouponType;
  value: number;
  min_order_amount?: number | null;
  max_uses?: number | null;
  expires_at?: string | null;
  active?: boolean;
}

export function useAdminCouponCreateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AdminCouponPayload) => {
      const response = await api.post<{ success: boolean; message: string; data: Coupon }>(
        "/admin/coupons",
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCoupons });
    },
  });
}

export function useAdminCouponUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ couponId, ...payload }: Partial<AdminCouponPayload> & { couponId: number }) => {
      const response = await api.put<{ success: boolean; message: string; data: Coupon }>(
        `/admin/coupons/${couponId}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCoupons });
    },
  });
}

export function useAdminCouponDeleteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (couponId: number) => {
      const response = await api.delete<SimpleMessageResponse>(`/admin/coupons/${couponId}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCoupons });
    },
  });
}

export function useAdminSettingsQuery() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.adminSettings,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Setting[] }>("/admin/settings");
      return response.data.data;
    },
    enabled: isAdmin,
  });
}

export function useAdminSettingsUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: { key: string; value: string | number | boolean }[]) => {
      const response = await api.put<{ success: boolean; message: string; data: Setting[] }>(
        "/admin/settings",
        { settings },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings });
    },
  });
}

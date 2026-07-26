import { api } from "@/lib/api";
import type {
  ApiResponse,
  CountResponse,
  DashboardStats,
  NotificationItem,
  Order,
  PaginatedResponse,
  PaymentInitializeResponse,
  Service,
  SimpleMessageResponse,
  Transaction,
  User,
  Wallet,
  WalletListItem,
} from "@/types/api";

export const selectors = {
  authMe: (payload: ApiResponse<User>) => payload.data,
  profile: (payload: ApiResponse<User>) => payload.data,
  wallet: (payload: ApiResponse<Wallet>) => payload.data,
  walletTransactions: (payload: ApiResponse<PaginatedResponse<Transaction>>) => payload.data,
  orders: (payload: ApiResponse<PaginatedResponse<Order>>) => payload.data,
  services: (payload: { success: boolean; services: Service[] }) => payload.services,
  notifications: (payload: PaginatedResponse<NotificationItem>) => payload,
  unreadCount: (payload: CountResponse) => payload.count,
  adminDashboard: (payload: ApiResponse<DashboardStats>) => payload.data,
  adminUsers: (payload: { success: boolean; users: User[] }) => payload.users,
  adminServices: (payload: { success: boolean; services: Service[] }) => payload.services,
  adminWallets: (payload: { success: boolean; wallets: WalletListItem[] }) => payload.wallets,
};

export async function markNotificationRead(id: number) {
  const response = await api.put<SimpleMessageResponse>(`/notifications/${id}/read`);
  return response.data;
}

export async function createOrder(service_id: number, quantity: number) {
  const response = await api.post<ApiResponse<Order>>("/orders", { service_id, quantity });
  return response.data;
}

export async function initializePayment(amount: number) {
  const response = await api.post<PaymentInitializeResponse>("/payment/initialize", { amount });
  return response.data;
}

export async function adminActivateUser(userId: number) {
  const response = await api.post<SimpleMessageResponse>(`/admin/users/${userId}/activate`);
  return response.data;
}

export async function adminSuspendUser(userId: number) {
  const response = await api.post<SimpleMessageResponse>(`/admin/users/${userId}/suspend`);
  return response.data;
}

export async function adminCreditWallet(userId: number, amount: number) {
  const response = await api.post<{ success: boolean; balance: number | string }>(`/admin/wallets/${userId}/credit`, { amount });
  return response.data;
}

export async function adminDebitWallet(userId: number, amount: number) {
  const response = await api.post<{ success: boolean; balance: number | string; message?: string }>(`/admin/wallets/${userId}/debit`, { amount });
  return response.data;
}

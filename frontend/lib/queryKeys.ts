/** Centralized query key factory so invalidations stay consistent across hooks. */
export const queryKeys = {
  me: ["me"] as const,
  profile: ["profile"] as const,
  wallet: ["wallet"] as const,
  walletTransactions: ["wallet", "transactions"] as const,
  orders: ["orders"] as const,
  services: ["services"] as const,
  notifications: ["notifications"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
  adminDashboard: ["admin", "dashboard"] as const,
  adminDashboardChart: ["admin", "dashboard", "chart-data"] as const,
  adminUsers: ["admin", "users"] as const,
  adminServices: ["admin", "services"] as const,
  adminWallets: ["admin", "wallets"] as const,
  adminOrders: (page: number) => ["admin", "orders", page] as const,
};

export interface PaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number | null;
  last_page: number;
  last_page_url: string;
  links: PaginationLink[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at?: string | null;
  is_admin?: boolean;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
  wallet?: Wallet | null;
  orders?: Order[];
}

export interface Wallet {
  id: number;
  user_id?: number;
  balance: number | string;
  currency: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  status?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  active_services_count?: number;
  services_count?: number;
}

export interface Service {
  id: number;
  name: string;
  slug?: string;
  /** Legacy free-text category label, kept for backward compatibility. Always a string (never the relation). */
  category?: string;
  category_id?: number | null;
  /**
   * Eager-loaded Category relation. Backend PHP relation method is named
   * `categoryGroup()` (to avoid colliding with the legacy `category` string
   * column above), but Laravel's Eloquent JSON serialization automatically
   * snake_cases relation keys, so this arrives over the wire as
   * `category_group` — matching the snake_case convention used by every
   * other field in this API (`category_id`, `provider_id`, `created_at`, ...).
   */
  category_group?: Category | null;
  description?: string | null;
  price: number | string;
  currency?: string;
  /** null = unlimited stock. */
  stock?: number | null;
  active?: boolean;
  provider_id?: number | null;
  provider?: { id: number; name: string } | null;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  id: number;
  user_id?: number;
  service_id: number;
  quantity: number;
  subtotal?: number | string;
  created_at?: string;
  updated_at?: string;
  service?: Service;
}

export interface CartResponse {
  success: boolean;
  data: CartItem[];
  total: number;
}

export interface OrderItem {
  id: number;
  order_id?: number;
  service_id: number;
  quantity: number;
  price: number | string;
  created_at?: string;
  updated_at?: string;
  service?: Service;
}

export interface Order {
  id: number;
  user_id?: number;
  service_id?: number;
  quantity?: number;
  amount?: number | string;
  price?: number | string;
  reference?: string;
  order_number?: string;
  total?: number | string;
  /** Phase 4: set only when a coupon was applied at checkout. */
  coupon_code?: string | null;
  discount?: number | string | null;
  /** Phase 5: set by an admin when fulfilling the order; triggers a delivery email once. */
  delivery_content?: string | null;
  delivered_at?: string | null;
  payment_method?: string | null;
  payload?: Record<string, unknown> | null;
  provider_reference?: string | null;
  details?: Record<string, unknown> | null;
  status: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
  service?: Service;
  items?: OrderItem[];
}

export type OrderStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface Transaction {
  id: number;
  user_id?: number;
  wallet_id?: number;
  reference?: string;
  amount: number | string;
  status: string;
  type: string;
  description?: string;
  gateway?: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
  /** Populated only for `type === "purchase"` transactions — the order that
   * was paid for. Null for deposit/credit/debit transactions. */
  order?: Pick<Order, "id" | "reference" | "order_number" | "status"> | null;
}

export interface NotificationItem {
  id: number;
  title?: string;
  message?: string;
  type?: string;
  is_read?: boolean;
  read_at?: string | null;
  created_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface DashboardStats {
  users?: number;
  orders?: number;
  services?: number;
  completed_orders?: number;
  pending_orders?: number;
  wallet_balance?: number | string;
  revenue?: number | string;
}

export interface CountResponse {
  count: number;
}

export interface SimpleMessageResponse {
  success?: boolean;
  message: string;
}

export interface PaymentInitializeResponse {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
}

export interface WalletListItem extends User {
  wallet: Wallet | null;
}

/** One day's worth of order-count/revenue data, used by the admin dashboard charts. */
export interface ChartDataPoint {
  date: string;
  orders: number;
  revenue: number;
}

/**
 * Phase 4 (Providers/Coupons/Settings). `api_key` is never sent to the
 * browser — only a masked hint and a boolean flag so the admin UI can show
 * "a key is set" without ever exposing the plaintext credential.
 */
export interface Provider {
  id: number;
  name: string;
  slug: string;
  base_url: string;
  api_key_masked?: string | null;
  has_api_key: boolean;
  active: boolean;
  services_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type CouponType = "percentage" | "fixed";

export interface Coupon {
  id: number;
  code: string;
  type: CouponType;
  value: number | string;
  min_order_amount?: number | string | null;
  max_uses?: number | null;
  used_count: number;
  expires_at?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CouponPreview {
  code: string;
  type: CouponType;
  value: number | string;
  discount: number;
  total_after_discount: number;
}

export type SettingType = "string" | "integer" | "float" | "boolean" | "json";

export interface Setting {
  id: number;
  key: string;
  value: string | null;
  type: SettingType;
  group: string;
  label?: string | null;
  created_at?: string;
  updated_at?: string;
}

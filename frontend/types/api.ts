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
  /** Legacy free-text category label, kept for backward compatibility. */
  category?: string;
  category_id?: number | null;
  /** Eager-loaded Category relation serialized as category_group. */
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
  /** From withAvg('reviews', 'rating'). */
  reviews_avg_rating?: number | string | null;
  /** From withCount('reviews'). */
  reviews_count?: number;
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
  /** Set only when a coupon was applied at checkout. */
  coupon_code?: string | null;
  discount?: number | string | null;
  /** Set by an admin when fulfilling the order. */
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

  /** Linked purchase transaction, matched by the order reference. */
  transaction?: Transaction | null;
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface Transaction {
  id: number;
  user_id?: number;
  wallet_id?: number;
  reference?: string;
  amount: number | string;
  currency?: string;
  status: string;
  type: string;
  description?: string;
  gateway?: string;
  gateway_reference?: string | null;
  failure_reason?: string | null;
  idempotency_key?: string | null;
  created_at?: string;
  updated_at?: string;
  user?: User;

  /** Populated for purchase transactions when the order relation exists. */
  order?: Pick<
    Order,
    "id" | "reference" | "order_number" | "status"
  > | null;
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

/** One day's worth of order-count/revenue data. */
export interface ChartDataPoint {
  date: string;
  orders: number;
  revenue: number;
}

/** One day's new-signup count. */
export interface SignupDataPoint {
  date: string;
  count: number;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

export interface TopServiceStat {
  service_id: number | null;
  name: string;
  orders: number;
  revenue: number;
}

export interface CategoryRevenueStat {
  category: string;
  revenue: number;
}

/** GET /admin/analytics/overview?days=7|30|90|365. */
export interface AnalyticsOverview {
  range_days: number;
  summary: {
    orders_in_range: number;
    completed_orders_in_range: number;
    revenue_in_range: number;
    average_order_value: number;
    new_users_in_range: number;
  };
  status_breakdown: OrderStatusCount[];
  top_services: TopServiceStat[];
  revenue_by_category: CategoryRevenueStat[];
  signups_series: SignupDataPoint[];
  coupon_usage: {
    redemptions: number;
    total_discount: number;
  };
}

/** Provider Router health status. */
export type ProviderHealthStatus = "healthy" | "degraded" | "offline";

export interface Provider {
  id: number;
  name: string;
  slug: string;
  base_url: string;
  api_key_masked?: string | null;
  has_api_key: boolean;
  active: boolean;
  services_count?: number;
  category?: string | null;
  priority?: number;
  is_primary?: boolean;
  is_backup?: boolean;
  health_status?: ProviderHealthStatus;
  is_routable?: boolean;
  is_in_cooldown?: boolean;
  cooldown_until?: string | null;
  failure_count?: number;
  success_count?: number;
  success_rate?: number | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_health_check_at?: string | null;
  timeout_seconds?: number | null;
  is_real_adapter?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProviderHealthCheck {
  id: number;
  provider_id: number;
  status: ProviderHealthStatus;
  response_time_ms?: number | null;
  http_status?: number | null;
  error_code?: string | null;
  error_message?: string | null;
  checked_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceProviderRoute {
  id: number;
  service_id: number;
  provider_id: number;
  provider: {
    id: number;
    name: string;
    slug: string;
    active: boolean;
    health_status: ProviderHealthStatus;
    is_routable: boolean;
  } | null;
  priority: number;
  enabled: boolean;
  role: "primary" | "backup";
  position: number;
  provider_service_id?: string | null;
  provider_cost?: number | string | null;
  failure_count: number;
  success_count: number;
  success_rate: number | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
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

export type SettingType =
  | "string"
  | "integer"
  | "float"
  | "boolean"
  | "json";

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

export interface Review {
  id: number;
  user_id: number;
  service_id: number;
  order_id?: number | null;
  rating: number;
  comment?: string | null;
  created_at?: string;
  updated_at?: string;
  user?: { id: number; name: string };
}

/** Virtual-number/SMS-OTP rentals. */
export interface VirtualNumberProviderOption {
  id: number;
  slug: string;
  name: string;
}

export interface VirtualNumberCountry {
  code: string;
  name: string;
}

export interface VirtualNumberServiceOption {
  code: string;
  name: string;
  cost_usd: number;
  count: number;
}

export type VirtualNumberOrderStatus =
  | "pending"
  | "waiting_code"
  | "received"
  | "cancelled"
  | "expired"
  | "refunded"
  | "failed";

export interface VirtualNumberOrder {
  id: number;
  user_id?: number;
  provider_id?: number | null;
  provider_slug: string;
  external_id: string;
  phone_number?: string | null;
  country: string;
  service_code: string;
  service_name?: string | null;
  operator?: string | null;
  cost_usd: number | string;
  exchange_rate: number | string;
  markup_percent: number | string;
  price_ngn: number | string;
  currency: string;
  status: VirtualNumberOrderStatus;
  sms_code?: string | null;
  sms_text?: string | null;
  reference: string;
  expires_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  average_rating: number | null;
  reviews_count: number;
  my_review: Review | null;
}

export interface PublicSettings {
  site_name: string;
  support_email: string | null;
}

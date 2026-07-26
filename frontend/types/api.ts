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

export interface Service {
  id: number;
  name: string;
  slug?: string;
  category?: string;
  description?: string | null;
  price: number | string;
  active?: boolean;
  provider_id?: number | null;
  provider?: { id: number; name: string } | null;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id: number;
  user_id?: number;
  service_id?: number;
  quantity?: number;
  amount?: number | string;
  price?: number | string;
  details?: Record<string, unknown> | null;
  status: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
  service?: Service;
}

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

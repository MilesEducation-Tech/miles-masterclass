import { CommonResponse, RouteConfig } from './http.model';

/**
 * The user's current subscription, as `GET /current-plan/` returns it.
 * Lived in `auth.model.ts` until the auth layer was removed.
 */
export interface CurrentPlanData {
  id: number;
  remaining_days: number;
  paid_amount: number;
  transaction_mode: string;
  subscription_status: string;
  trial_duration: number | null;
  current_time: string;
  platform: string;
  valid_from: string;
  valid_to: string;
}

export interface CartSteps {
  id: number;
  name: string | null;
  step: number;
  icon: string | null;
  active: boolean;
}

export const PAYMENT_ROUTES = {
  getOrders: {
    path: 'user/order/my_orders/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<OrderByIdResponseData[]>>,
  reactivateAutoRenewal: {
    path: 'promotion/subscription/reactivate/',
    method: 'POST',
  } as RouteConfig<{ order_id: number }, SubscriptionActionResponse>,
  cancelAutoRenewal: {
    path: 'promotion/subscription/cancel/',
    method: 'POST',
  } as RouteConfig<{ order_id: number }, SubscriptionActionResponse>,
  navigateToStripeCustomerDashboard: {
    path: 'user/order/create_customer_portal/',
    method: 'POST',
  } as RouteConfig<{ order_id: number }, StripePortalResponse>,
} as const;

export interface SubscriptionActionResponse {
  message: string;
  status: string;
}

export interface StripePortalResponse {
  session_url: string;
}

export interface UserAddress {
  id: number;
  phone_no: string;
  email_id: string;
  address1: string;
  locality: string;
  landmark: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
  is_active: boolean;
  created_at: string;
  user: number;
  updated_by: number | null;
}

export interface SelectedCountry {
  id: number;
  country_name: string;
  country_code: string;
  currency: string;
  currency_symbol: string;
}

export interface AppliedCoupon {
  id: number;
  coupon_name: string;
  coupon_code: string;
  discount: number;
  discount_type: string;
  min_cart_amount: number;
  max_user_apply: number;
  description: string;
  applicable_country: string | null;
}

export interface TransactionDetails {
  id: number;
  paid_amount: number;
  payment_mode: 'Card' | 'UPI' | 'NetBanking' | 'card' | string;
  approval_url: string | null;
  payment_id: string;
  payment_client_secret: string | null;
  payment_status: 'Pending' | 'Completed' | 'Failed' | 'Success';
  invoice_url: string | null;
  receipt_url: string | null;
  status: boolean;
  transaction_mode: string;
  created_at: string;
  order: number;
}

export interface OrderSubscriptionItemDetails {
  id: number;
  subscription_name: string;
  plan_duration: number;
  basic_price: number;
  discount: number;
  discount_type: 'percent' | 'amount';
  subscription_type: string;
  valid_from: string;
  valid_to: string;
  description: string;
}

export interface OrderItem {
  id: number;
  remaining_days: number;
  paid_amount: number;
  transaction_mode: string;
  subscription_status: 'ReSubscribe' | 'Active' | 'Expired' | 'Deactivate' | string;
  trial_duration: number | null;
  current_time: string;
  platform: 'Stripe' | string;
  item_type: 'subscription' | 'masterclass' | 'podcast' | 'nano-learning' | 'webinar';
  base_price: number;
  selling_price: number;
  discount: number;
  discount_type: 'amount' | 'percent';
  valid_from: string;
  valid_to: string;
  is_unlimited: boolean;
  status: boolean;
  subscription_type: string | null;
  created_at: string;
  order: number;
  subscription: number | null;
  masterclass: number | null;
  nano_learning: number | null;
  webinar: number | null;
  item_details: OrderSubscriptionItemDetails;
}

export interface CountryDetails extends SelectedCountry {
  created_at: string;
  tax_percent: number;
  updated_by: number | null;
}

export interface OrderByIdResponseData {
  id: number;
  order_items: OrderItem[];
  billing_address: UserAddress;
  coupon_details: AppliedCoupon | null;
  transcation_details: TransactionDetails;
  country_details: CountryDetails;
  adjusted_total_amount: number;
  sub_total: number;
  total_amount: number;
  total_tax: number;
  tax_percentage: number;
  total_discount: number;
  total_discount_percent: number;
  payment_status: 'Pending' | 'Success' | 'Failed';
  order_status: 'Confirmed' | 'Cancelled' | 'Pending';
  payer_id: string | null;
  payment_id: string | null;
  session_id: string;
  status: boolean;
  created_at: string;
  user: number;
  selected_country: number;
  coupon_applied: number | null;
  updated_by: number | null;
}

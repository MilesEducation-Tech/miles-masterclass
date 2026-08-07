import { CommonResponse, RouteConfig } from './http.model';

export interface CartSteps {
  id: number;
  name: string | null;
  step: number;
  icon: string | null;
  active: boolean;
}

export const PAYMENT_ROUTES = {
  myBucket: {
    path: 'user/cart/mybucket/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<CartDetails>>,
  addBucketItem: {
    path: 'user/cart/',
    method: 'POST',
  } as RouteConfig<
    void,
    CommonResponse<CartDetails>,
    {},
    {
      item_id: number;
      item_type: 'subscription' | 'masterclass' | 'podcast' | 'nano-learning' | 'webinar';
      pay_method: 'monthly' | 'yearly';
    }
  >,
  removeBucketItem: {
    path: 'user/cart/remove_item/',
    method: 'POST',
  } as RouteConfig<void, CommonResponse<CartDetails>, {}, { cartitem_id: number }>,
  listCoupon: {
    path: 'promotion/coupons/',
    method: 'GET',
  } as RouteConfig<void, CouponListResponse>,
  applyCoupon: {
    path: 'promotion/coupons/apply_coupon/',
    method: 'POST',
  } as RouteConfig<void, CommonResponse<CartDetails>, {}, { coupon_code: string }>,
  removeCoupon: {
    path: 'promotion/coupons/remove_coupon/',
    method: 'POST',
  } as RouteConfig<void, CommonResponse<CartDetails>, {}, { coupon_code: string }>,
  listAddress: {
    path: 'user/address/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<UserAddress[]>>,
  addAddress: {
    path: 'user/address/',
    method: 'POST',
  } as RouteConfig<void, CommonResponse<UserAddress>, {}, BillingAddressPayload>,
  updateAddress: {
    path: 'user/address/:id/',
    method: 'PUT',
  } as RouteConfig<void, CommonResponse<UserAddress>>,
  deleteAddress: {
    path: 'user/address/:id/',
    method: 'DELETE',
  } as RouteConfig<void, CommonResponse<UserAddress>>,
  proceedToPayment: {
    path: 'user/order/proceed_checkout/',
    method: 'POST',
  } as RouteConfig<
    void,
    CommonResponse<CheckoutResponseData>,
    {},
    { cart_id: number; address_id: number; is_trial?: boolean }
  >,
  getOrderById: {
    path: 'user/order/order_details/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<OrderByIdResponseData>, { order_id: string }, {}>,
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
  forcePurchase: {
    path: 'stripe/force-subscription/',
    method: 'POST',
  } as RouteConfig<{ order_id: number }, SubscriptionActionResponse>,
  retryPayment: {
    path: 'user/order/create_customer_portal/',
    method: 'POST',
  } as RouteConfig<{ order_id: number }, StripePortalResponse>,
  checkAndSubscribe: {
    path: 'lms/check-and-subscribe/',
    method: 'GET',
  } as RouteConfig<void, SubscriptionActionResponse>,
  navigateToStripeCustomerDashboard: {
    path: 'user/order/create_customer_portal/',
    method: 'POST',
  } as RouteConfig<{ order_id: number }, StripePortalResponse>,
  getSubscriptionPlans: {
    path: 'promotion/subscription/',
    method: 'GET',
  } as RouteConfig<void, SubscriptionPlansResponse>,
} as const;

export interface SubscriptionActionResponse {
  message: string;
  status: string;
}

export interface StripePortalResponse {
  session_url: string;
}

export interface SubscriptionPlansResponse {
  status_code: number;
  data: SubscriptionPlan[];
  message: string;
}

export interface PlanFeatureDetail {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  has_conditions?: boolean;
}

export interface PlanFeature {
  id: number;
  planfeature: PlanFeatureDetail | null;
}

export interface PlanPriceDetail {
  base_price: number;
  selling_price: number;
  currency_code: string;
  discount: number;
  currency_symbol: string;
  discount_percent: number;
  discount_type: string;
  // Country-dependent: when true, the plan can be paid monthly (EMI). The
  // monthly amount is derived client-side as the yearly price ÷ 12.
  emi_available: boolean;
}

export interface PlanIapDetails {
  apple_product_id: string | null;
  google_product_id: string | null;
}

export interface PlanMyOrder {
  id: number;
  remaining_days: number;
  paid_amount: number;
  transaction_mode: string;
  subscription_status: string;
  trial_duration: number | null;
  current_time: string;
  platform: string;
  item_type: string;
  base_price: number;
  selling_price: number;
  discount: number;
  discount_type: string;
  valid_from: string;
  valid_to: string;
  is_unlimited: boolean;
  status: boolean;
  subscription_type: string | null;
  created_at: string;
  order: number;
  subscription: number;
  masterclass: number | null;
  nano_learning: number | null;
  webinar: number | null;
}

export interface SubscriptionPlan {
  id: number;
  features: PlanFeature[];
  is_added_to_cart: boolean;
  is_in_myorder: PlanMyOrder | null;
  min_remaining_days: number;
  price_detail: PlanPriceDetail | null;
  is_old_subscriber: boolean;
  iap_details: PlanIapDetails;
  is_partner_code_applied: boolean;
  is_firm_sponsorship_applied: boolean;
  created_at: string;
  subscription_name: string;
  plan_duration: number;
  free_trial_days: number;
  subscription_type: string | null;
  is_unlimited_trial_enabled: boolean;
  valid_from: string | null;
  valid_to: string | null;
  description: string;
  plan_sorting_order: number;
  is_active: boolean;
  is_recommended: boolean;
  apple_inapp_product_id: string | null;
  stripe_price_id_year1: string | null;
  stripe_price_id_year2: string | null;
  google_inapp_product_id: string | null;
  is_trial_activated_on_android: boolean;
  is_trial_activated_on_ios: boolean;
  updated_by: number;
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

export interface CartInstructor {
  id: number;
  first_name: string;
  last_name: string;
  horizontal_thumbnail: string;
}

export interface BaseCartItemDetails {
  id: number;
  title: string;
  description: string;
  category_name: string;
  cpe_credits: number;
  date_of_completion: string;
}

export interface CartSubscriptionItemDetails extends BaseCartItemDetails {
  delivery_mode: 'subscription';
  free_trial_days: number;
}

export interface CartCourseItemDetails extends BaseCartItemDetails {
  delivery_mode: 'masterclass' | 'podcast' | 'nano-learning' | 'webinar';
  horizontal_thumbnail: string;
  instructor_first_name: string;
  instructor_last_name: string;
  instructors: CartInstructor[];
}

export type CartItemDetails = CartSubscriptionItemDetails | CartCourseItemDetails;

export interface CartItemData {
  id: number;
  cart_id: number;
  item_type: string | null;
  item_details: CartItemDetails;
  base_price: number;
  selling_price: number;
  // Chosen billing cycle for this item (subscriptions only). When 'monthly' the
  // UI shows the monthly figure (price ÷ 12) alongside the annual total.
  pay_method?: 'monthly' | 'yearly';
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

export interface CartDetails {
  cart_id: number;
  total_amount: number;
  sub_amount: number;
  tax_amount: number;
  total_discount_amount: number;
  cartitem_data: CartItemData[];
  total_discount_percent: number;
  applied_coupon: AppliedCoupon | null;
  selected_country: SelectedCountry;
  coupon_applicable: boolean | null;
  applied_coupon_id: number | null;
  is_old_subscriber: boolean;
}

export interface CouponList {
  id: number;
  coupon_name: string;
  coupon_code: string;
  coupon_applicable: boolean;
  discount: number;
  discount_type: 'percent' | 'fixed'; // Assuming these are the possible values
  description: string;
  valid_from: string; // ISO date string
  valid_to: string; // ISO date string
  max_user_apply: number;
  terms_and_conditions: string;
  applicable_for: 'All' | string; // You can expand this based on possible values
  coupon_category: 'all' | string; // You can expand this based on possible values
  status: boolean;
  applicable_country: string | null;
  coupon_scope: 'specific' | 'all';
}

// If you want to type the entire API response
export interface CouponListResponse {
  success: boolean;
  message: string | null;
  status: number;
  data: CouponList[];
  safe: boolean;
}

export interface BillingAddressPayload {
  id?: string;
  phone_no: string;
  email_id: string;
  address1: string;
  locality: string;
  landmark: string;
  country: string;
  state: string;
  city: string;
  zipcode: number;
}

export interface OrderDetails {
  id: number;
  total_amount: number;
  sub_total: number;
  total_discount: number;
  total_discount_percent: number;
  total_tax: number;
  billing_address_id: number;
  payment_status: 'Pending' | 'Completed' | 'Failed';
}

export interface OrderItemDetails {
  id: number;
  plan_name: string;
  details: string;
  category_name: string;
  delivery_mode: 'Subscription' | 'masterclass' | 'podcast' | 'nano-learning' | 'webinar';
  cpe_credits: number;
  date_of_completion: string;
}

export interface OrderItemData {
  id: number;
  cart_id: number;
  item_type: string | null;
  item_details: OrderItemDetails;
  base_price: number;
  selling_price: number;
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

export interface CheckoutResponseData {
  order_id: number;
  order_details: OrderDetails;
  applied_coupon: AppliedCoupon | null;
  orderitem_data: OrderItemData[];
  selected_country: SelectedCountry;
  billing_address: UserAddress;
  transcation_details: TransactionDetails;
  approval_url: string;
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

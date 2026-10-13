import { inject, Service, signal, computed, effect, linkedSignal, Injector } from '@angular/core';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { RouteResponse } from '@core/models/http.model';
import {
  PAYMENT_ROUTES,
  BillingAddressPayload,
  UserAddress,
  OrderByIdResponseData,
} from '@core/models/payment.model';
import { NotificationService } from '@core/services/notification/notification';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { Cart } from '@core/models/commerce.model';
import { CartStore } from '@core/services/cart/cart-store';
import { CountryContext } from '@core/services/country-context/country-context';
import { COMMERCE_ROUTES, Plan, parsePlans } from '@features/payment/models/commerce.model';
import { NgpDialogManager } from 'ng-primitives/dialog';
// Dialog components are loaded lazily (dynamic import in the open* methods below)
// so they — and their `@angular/forms` dependency — stay out of the initial
// bundle. This facade is eagerly instantiated via the root `Utils` service, so a
// static import would drag every dialog into the initial chunk. Types are
// import-only (erased at build time); the runtime class comes from `import()`.
import { Analytics } from '@core/services/analytics/analytics';

type ListAddressResponse = RouteResponse<typeof PAYMENT_ROUTES.listAddress>;
type AddAddressResponse = RouteResponse<typeof PAYMENT_ROUTES.addAddress>;
type CheckoutResponse = RouteResponse<typeof PAYMENT_ROUTES.proceedToPayment>;
type OrderByIdResponse = RouteResponse<typeof PAYMENT_ROUTES.getOrderById>;
type OrdersResponse = RouteResponse<typeof PAYMENT_ROUTES.getOrders>;
type CancelAutoRenewalResponse = RouteResponse<typeof PAYMENT_ROUTES.cancelAutoRenewal>;
type ReactivateAutoRenewalResponse = RouteResponse<typeof PAYMENT_ROUTES.reactivateAutoRenewal>;
type StripePortalResponse = RouteResponse<typeof PAYMENT_ROUTES.navigateToStripeCustomerDashboard>;

/**
 * The CAIRA error envelope's human message (safe to show) and machine reason
 * (`data.reason`, stable to branch on). Some refusals carry only a message.
 */
function commerceErrorOf(err: unknown): { reason?: string; message: string } {
  // Status 0 never reached the API (offline, CORS); its `error` is the browser's own
  // TypeError, whose message ("Failed to fetch") is not for the learner.
  if (!(err instanceof HttpErrorResponse) || err.status === 0) {
    return { message: "We couldn't reach the server. Check your connection and try again." };
  }
  const body: unknown = err.error;
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const data = fields['data'];
  const reason =
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>)['reason'] : null;
  return {
    reason: typeof reason === 'string' ? reason : undefined,
    message:
      typeof fields['message'] === 'string'
        ? fields['message']
        : 'Something went wrong. Please try again.',
  };
}

@Service()
export class PaymentFacade {
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly http = inject(ApiClient);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly injector = inject(Injector);
  private readonly country = inject(CountryContext).current;
  private readonly analytics = inject(Analytics);

  /** The commerce cart. `CartStore` (core) owns it because the footer badge reads it too. */
  private readonly cart = inject(CartStore);
  /**
   * Tells the learner once when a cart read found their stored coupon no longer valid
   * (it expired or stopped qualifying). The cart that comes back already has it removed.
   */
  private readonly couponRemovedNotice = effect(() => {
    const removed = this.cart.cart()?.coupon_removed;
    if (removed) {
      this.notification.info('Coupon removed', `Your code ${removed.code} no longer applies.`);
    }
  });

  /** The order the invoice page shows; `null` idles the read. Set through `loadOrderById()`. */
  private readonly orderId = signal<string | null>(null);
  private readonly orderResource = httpResource<OrderByIdResponse>(() => {
    const id = this.orderId();
    return id
      ? { url: apiUrl(PAYMENT_ROUTES.getOrderById.path), params: { order_id: id } }
      : undefined;
  });
  /** Guarded: `value()` throws on an errored resource. */
  readonly orderData = computed<OrderByIdResponseData | null>(() =>
    this.orderResource.hasValue() ? (this.orderResource.value()?.data ?? null) : null,
  );
  private readonly orderErrorLog = effect(() => {
    const err = this.orderResource.error();
    if (err) this.logger.error('Failed to load order details', err);
  });

  /**
   * Order history. OPT-IN, because this facade is root-provided and built on every
   * page (via `Utils`): nothing is fetched until the orders page calls `loadOrders()`.
   */
  private readonly ordersWanted = signal(false);
  private readonly ordersResource = httpResource<OrdersResponse>(() =>
    this.ordersWanted() ? apiUrl(PAYMENT_ROUTES.getOrders.path) : undefined,
  );
  /** Guarded: `value()` throws on an errored resource. */
  readonly ordersData = computed<OrderByIdResponseData[]>(() =>
    this.ordersResource.hasValue() ? (this.ordersResource.value()?.data ?? []) : [],
  );
  readonly ordersLoading = computed(() => this.ordersResource.isLoading());
  readonly ordersError = computed(() =>
    this.ordersResource.error() ? 'Failed to load order history' : null,
  );
  private readonly ordersErrorLog = effect(() => {
    const err = this.ordersResource.error();
    if (err) this.logger.error('Failed to load orders', err);
  });

  /**
   * `loading` / `error` cover the checkout POST (`opLoading` / `opError`) and the
   * order-detail read. There is no cart read any more (`user/cart/mybucket/`
   * was removed 2026-10-11, see `CartStore`); `paymentGuard` still waits on
   * `loading`, so it waits out a checkout POST as before.
   */
  private readonly opLoading = signal(false);
  private readonly opError = signal<string | null>(null);
  // The order read joins the OR: it used to drive `opLoading`/`opError` by hand,
  // and the invoice skeleton and `paymentGuard` both read these.
  readonly loading = computed(() => this.opLoading() || this.orderResource.isLoading());
  readonly error = computed(
    () => this.opError() ?? (this.orderResource.error() ? 'Failed to load order details' : null),
  );
  /**
   * Billing addresses. OPT-IN like the orders read: the billing page calls
   * `loadBillingAddress()`, so the guard only ever sees addresses once that page asked.
   */
  private readonly addressesWanted = signal(false);
  private readonly addressResource = httpResource<ListAddressResponse>(() =>
    this.addressesWanted() ? apiUrl(PAYMENT_ROUTES.listAddress.path) : undefined,
  );
  /**
   * `linkedSignal`, not `computed`: saving, editing and deleting an address patch this
   * list in place with the server's answer; a reload replaces it. Guarded, since
   * `value()` throws on an errored resource.
   */
  readonly billingAddress = linkedSignal<UserAddress[]>(() =>
    this.addressResource.hasValue() ? (this.addressResource.value()?.data ?? []) : [],
  );
  private readonly addressErrorLog = effect(() => {
    const err = this.addressResource.error();
    if (err) this.logger.error('Failed to load billing address', err);
  });
  /**
   * User's selected address, linked to `billingAddress`: the selection is kept
   * while that address is still in the list, otherwise it falls back to the
   * first address (or null when the list is empty).
   */
  selectedAddressId = linkedSignal<UserAddress[], number | null>({
    source: this.billingAddress,
    computation: (addresses, previous) => {
      const prev = previous?.value ?? null;
      if (prev != null && addresses.some((a) => a.id === prev)) return prev;
      return addresses[0]?.id ?? null;
    },
  });
  isEditingAddress = signal<boolean>(false);

  /**
   * The subscription plans (`GET api/v1/subscriptions/plans/`), shared by the plan
   * page and the subscription dialog. OPT-IN: nothing is fetched until one of them
   * calls `loadPlans()`.
   *
   * Priced for the URL market: `X-Country-Code` is named here as well as by
   * `appInterceptor`, so a country change re-reads the plans. A signed-in learner
   * may get a personal price, so the response is never stored. SSR: the plan page
   * renders on the server, and Angular's transfer cache hands an anonymous fetch to
   * the browser; a signed-in one carries `Authorization`, which the cache skips.
   */
  private readonly plansWanted = signal(false);
  private readonly plansResource = httpResource(
    () =>
      this.plansWanted()
        ? {
            url: apiUrl(COMMERCE_ROUTES.plans.path),
            headers: { 'X-Country-Code': this.country().toUpperCase() },
          }
        : undefined,
    { parse: parsePlans },
  );
  /** In `sort_order`. Guarded, since `value()` throws on an errored resource. */
  readonly plans = computed<Plan[]>(() =>
    this.plansResource.hasValue() ? this.plansResource.value() : [],
  );
  /** The plan to pre-select: CAIRA's `is_default`, otherwise the first. */
  readonly defaultPlan = computed<Plan | null>(
    () => this.plans().find((p) => p.is_default) ?? this.plans()[0] ?? null,
  );
  readonly plansLoading = computed(() => this.plansResource.isLoading());
  readonly plansError = computed(() =>
    this.plansResource.error() ? 'Failed to load subscription plans' : null,
  );
  private readonly plansErrorLog = effect(() => {
    const err = this.plansResource.error();
    if (err) this.logger.error('Failed to load subscription plans', err);
  });

  // Invoice-related computed signals
  readonly invoiceItems = computed(() => this.orderData()?.order_items ?? []);
  readonly invoiceItemCount = computed(() => this.invoiceItems().length);
  readonly invoiceBillingAddress = computed(() => this.orderData()?.billing_address ?? null);
  readonly invoiceFormattedAddress = computed(() => {
    const a = this.invoiceBillingAddress();
    if (!a) return '';
    return [a.address1, a.locality, a.landmark, a.city, a.state, a.country, a.zipcode]
      .filter(Boolean)
      .join(', ');
  });
  readonly invoiceUserData = computed(() => {
    const addr = this.invoiceBillingAddress();
    return {
      name: addr?.email_id ?? '',
      email: addr?.email_id ?? '',
      mobile: addr?.phone_no ?? '',
    };
  });
  readonly invoiceCurrency = computed(() => this.orderData()?.country_details?.currency ?? 'USD');
  readonly invoiceCurrencySymbol = computed(
    () => this.orderData()?.country_details?.currency_symbol ?? '$',
  );
  readonly invoicePaymentStatus = computed(() => this.orderData()?.payment_status ?? null);
  readonly invoiceTransactionDetails = computed(
    () => this.orderData()?.transcation_details ?? null,
  );

  // Invoice price-related computed signals
  readonly invoiceSubTotal = computed(() => this.orderData()?.sub_total ?? 0);
  readonly invoiceTotalDiscount = computed(() => this.orderData()?.total_discount ?? 0);
  readonly invoiceTotalDiscountPercent = computed(
    () => this.orderData()?.total_discount_percent ?? 0,
  );
  // Grand total is the net payable AFTER discounts/coupon (`adjusted_total_amount`),
  // not the gross `total_amount` — otherwise a full-coupon order shows the pre-
  // discount price instead of what was actually charged.
  readonly invoiceGrandTotal = computed(() => this.orderData()?.adjusted_total_amount ?? 0);
  readonly invoiceTaxAmount = computed(() => this.orderData()?.total_tax ?? 0);
  readonly invoiceCouponDetails = computed(() => this.orderData()?.coupon_details ?? null);
  readonly invoiceProductDiscount = computed(() => {
    const items = this.invoiceItems();
    if (!items.length) return 0;
    let totalBase = 0;
    let totalSelling = 0;
    for (const item of items) {
      totalBase += item.base_price;
      totalSelling += item.selling_price;
    }
    return totalBase - totalSelling;
  });

  loadBillingAddress() {
    if (this.addressesWanted()) this.addressResource.reload();
    else this.addressesWanted.set(true);
  }

  saveBillingAddress(payload: BillingAddressPayload) {
    this.http.post<AddAddressResponse>(PAYMENT_ROUTES.addAddress.path, payload).subscribe({
      next: (res) => {
        this.notification.success('Success', 'Address saved successfully');
        const currentAddresses = this.billingAddress() || [];
        if (res?.data) {
          this.billingAddress.set([...currentAddresses, res.data]);
        }
      },
      error: (err) => {
        this.logger.error('Failed to save address', err);
      },
    });
  }

  updateBillingAddress(id: number, payload: BillingAddressPayload) {
    const path = PAYMENT_ROUTES.updateAddress.path.replace(':id', String(id));
    this.http.put<RouteResponse<typeof PAYMENT_ROUTES.updateAddress>>(path, payload).subscribe({
      next: (res) => {
        this.notification.success('Success', 'Address updated successfully');
        if (res?.data) {
          this.billingAddress.update((addresses) =>
            addresses.map((addr) => (addr.id === id ? res.data : addr)),
          );
        }
      },
      error: (err) => {
        this.logger.error('Failed to update address', err);
      },
    });
  }

  deleteAddress(id: number) {
    const path = PAYMENT_ROUTES.deleteAddress.path.replace(':id', String(id));
    this.http.delete(path).subscribe({
      next: () => {
        // selectedAddressId is linked to billingAddress and auto-clears here.
        this.billingAddress.update((addresses) => addresses.filter((a) => a.id !== id));
        this.notification.success('Success', 'Address deleted successfully');
      },
      error: (err) => {
        this.logger.error('Failed to delete address', err);
      },
    });
  }

  /**
   * Removes a cart line (C4). The answer is the whole cart; removing the last line
   * answers it `cancelled`, which `CartStore.set` drops so the next read starts fresh.
   */
  removeLine(lineId: string): void {
    const route = COMMERCE_ROUTES.removeLine;
    this.http.call({ ...route, path: route.path.replace(':line_id', lineId) }).subscribe({
      next: ({ data }) => {
        this.cart.set(data);
        this.notification.success('Removed', 'The plan was removed from your cart.');
      },
      error: (err) => {
        this.logger.error('Failed to remove the cart line', err);
        this.notification.error('Could not remove', commerceErrorOf(err).message);
      },
    });
  }

  /**
   * Applies a coupon code to the cart (D1); the server works out the discount. Emits the
   * updated cart, or errors with the API's `message`, which the caller shows under its field.
   */
  applyCoupon(code: string): Observable<Cart> {
    const cartId = this.cart.cart()?.id;
    return this.http
      .call(COMMERCE_ROUTES.applyCoupon, { code, ...(cartId ? { cart_id: cartId } : {}) })
      .pipe(
        map(({ data }) => data),
        tap((cart) => {
          this.cart.set(cart);
          this.notification.success(
            'Coupon applied',
            `${cart.coupon?.code ?? code} is on your cart.`,
          );
        }),
        catchError((err: unknown) => {
          this.logger.error('Failed to apply the coupon', err);
          return throwError(() => commerceErrorOf(err).message);
        }),
      );
  }

  /** Removes the cart's coupon (D2). Removing when none is applied is still a 200. */
  removeCoupon(): void {
    const cartId = this.cart.cart()?.id;
    this.http
      .call(COMMERCE_ROUTES.removeCoupon, undefined, cartId ? { params: { cart_id: cartId } } : {})
      .subscribe({
        next: ({ data }) => {
          this.cart.set(data);
          this.notification.success('Coupon removed', 'The coupon was removed from your cart.');
        },
        error: (err) => {
          this.logger.error('Failed to remove the coupon', err);
          this.notification.error('Could not remove the coupon', commerceErrorOf(err).message);
        },
      });
  }

  async openCouponDialog(): Promise<void> {
    const { CouponDialog } = await import('@features/payment/dialogs/coupon-dialog/coupon-dialog');
    this.dialogs.open(CouponDialog, { injector: this.injector });
  }

  proceedToPayment(isTrial = false) {
    const cartId = this.cart.cart()?.id;
    const addressId = this.selectedAddressId();

    if (!cartId || !addressId) {
      this.notification.error('Error', 'Please select a billing address to proceed.');
      return;
    }

    this.opLoading.set(true);

    this.http
      .post<CheckoutResponse>(PAYMENT_ROUTES.proceedToPayment.path, {
        cart_id: cartId,
        address_id: addressId,
        is_trial: isTrial,
      })
      .subscribe({
        next: (res) => {
          this.opLoading.set(false);
          if (res?.data?.approval_url) {
            this.analytics.trackEvent('begin_checkout', {
              cart_id: cartId,
              is_trial: isTrial,
              ...this.cartAnalyticsParams(),
            });
            window.location.href = res.data.approval_url;
          } else {
            this.notification.error('Error', 'Payment URL not available. Please try again.');
          }
        },
        error: (err) => {
          this.opLoading.set(false);
          this.logger.error('Failed to proceed to payment', err);
        },
      });
  }

  /**
   * Adds a plan to the cart (C2), then runs `onAdded` (the plan page goes to the
   * cart page) or opens the cart drawer. The answer is the whole cart, so it goes
   * straight into `CartStore`. Re-adding the plan already in the cart is harmless
   * (200, `created: false`); a different plan, an unpriced market or a full
   * subscription stack is a 409 whose `message` the learner sees.
   */
  addPlanToCart(plan: Plan, onAdded?: () => void): void {
    const cartId = this.cart.cart()?.id;
    this.http
      .call(COMMERCE_ROUTES.addLine, {
        product_id: plan.product.id,
        plan_id: plan.id,
        ...(cartId ? { cart_id: cartId } : {}),
      })
      .subscribe({
        next: ({ data }) => {
          this.cart.set(data.result);
          this.notification.success('Added to cart', `${plan.product.title} is in your cart.`);
          // GA needs numbers; this is the only place a price leaves its string.
          const listPrice = Number(plan.price.price);
          const sellingPrice = Number(plan.price.discount_price ?? plan.price.price);
          this.analytics.trackEvent('add_to_cart', {
            course_id: plan.id,
            course_type: 'subscription',
            currency: plan.price.currency,
            base_price: listPrice,
            selling_price: sellingPrice,
            items: [{ course_id: plan.id, course_type: 'subscription', price: sellingPrice }],
          });
          if (onAdded) onAdded();
          else this.openCartDrawer();
        },
        error: (err) => {
          this.logger.error('Failed to add the plan to the cart', err);
          this.notification.error('Could not add to cart', commerceErrorOf(err).message);
        },
      });
  }

  /**
   * Pricing + items snapshot of the cart, shared by the `cart_view` and `begin_checkout`
   * events. GA needs numbers, so the server's figures are converted here and only here;
   * nothing is summed.
   */
  private cartAnalyticsParams(pageName?: string): Record<string, unknown> {
    const cart = this.cart.cart();
    return {
      ...(pageName ? { page_name: pageName } : {}),
      currency: cart?.currency,
      base_price: Number(cart?.money.price_before_discount ?? 0),
      selling_price: Number(cart?.money.checkout_amount ?? 0),
      product_discount: Number(cart?.money.discount_amount ?? 0),
      items: (cart?.lines ?? []).map((line) => ({
        course_id: line.product_id,
        course_type: 'subscription',
        price: Number(line.money.final_amount),
      })),
    };
  }

  /** Fire `cart_view` for a payment-journey step (`cart` / `billing` / `review`). */
  trackCartView(pageName: string): void {
    this.analytics.trackEvent('cart_view', this.cartAnalyticsParams(pageName));
  }

  async openCartDrawer(): Promise<void> {
    const { CartDrawerDialog } =
      await import('@features/payment/dialogs/cart-drawer-dialog/cart-drawer-dialog');
    this.dialogs.open(CartDrawerDialog, { injector: this.injector });
  }

  /** The first call opts the plans in; later calls (retry, re-entering the plan page) re-read them. */
  loadPlans(): void {
    if (this.plansWanted()) this.plansResource.reload();
    else this.plansWanted.set(true);
  }

  readonly ordersCount = computed(() => this.ordersData().length);

  /** First call opts the orders page in; later calls (retry, after a mutation) refetch. */
  loadOrders() {
    if (this.ordersWanted()) this.ordersResource.reload();
    else this.ordersWanted.set(true);
  }

  /** Point the order read at `orderId`; the same id again refetches, as the old call did. */
  loadOrderById(orderId: string) {
    if (this.orderId() === orderId) this.orderResource.reload();
    else this.orderId.set(orderId);
  }

  cancelAutoRenewal(orderId: number) {
    this.http
      .post<CancelAutoRenewalResponse>(PAYMENT_ROUTES.cancelAutoRenewal.path, {
        order_id: orderId,
      })
      .subscribe({
        next: (res) => {
          this.notification.success('Success', res?.message ?? 'Auto renewal has been cancelled.');
          this.loadOrders();
        },
        error: (err) => {
          this.logger.error('Failed to cancel auto renewal', err);
        },
      });
  }

  reactivateAutoRenewal(orderId: number) {
    this.http
      .post<ReactivateAutoRenewalResponse>(PAYMENT_ROUTES.reactivateAutoRenewal.path, {
        order_id: orderId,
      })
      .subscribe({
        next: (res) => {
          this.notification.success(
            'Success',
            res?.message ?? 'Auto renewal has been reactivated.',
          );
          this.loadOrders();
        },
        error: (err) => {
          this.logger.error('Failed to reactivate auto renewal', err);
        },
      });
  }

  navigateToStripeCustomerDashboard(orderId: number) {
    this.http
      .post<StripePortalResponse>(PAYMENT_ROUTES.navigateToStripeCustomerDashboard.path, {
        order_id: orderId,
      })
      .subscribe({
        next: (res) => {
          if (res?.session_url) {
            window.open(res.session_url, '_blank');
          } else {
            this.notification.error('Error', 'Could not open Stripe dashboard.');
          }
        },
        error: (err) => {
          this.logger.error('Failed to open Stripe customer dashboard', err);
        },
      });
  }

  /**
   * Open the user-scoped Stripe Customer Portal — no order context. Hits the
   * same `create_customer_portal/` endpoint as the per-order flow, but with
   * an empty body so the backend issues a portal session bound to the
   * authenticated user rather than a specific order's payment.
   */
  openStripeCustomerPortal() {
    this.http
      .post<StripePortalResponse>(PAYMENT_ROUTES.navigateToStripeCustomerDashboard.path, {})
      .subscribe({
        next: (res) => {
          if (res?.session_url) {
            window.open(res.session_url, '_blank');
          } else {
            this.notification.error('Error', 'Could not open Stripe dashboard.');
          }
        },
        error: (err) => {
          this.logger.error('Failed to open Stripe customer portal', err);
        },
      });
  }
}

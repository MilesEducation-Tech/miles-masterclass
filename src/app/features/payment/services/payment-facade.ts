import {
  DOCUMENT,
  inject,
  Service,
  signal,
  computed,
  effect,
  linkedSignal,
  Injector,
} from '@angular/core';
import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import { SKIP_LOADING } from '@core/models/http.model';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { NotificationService } from '@core/services/notification/notification';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { Cart } from '@core/models/commerce.model';
import { CartStore } from '@core/services/cart/cart-store';
import { CountryContext } from '@core/services/country-context/country-context';
import {
  Address,
  AddressInput,
  COMMERCE_ROUTES,
  Coupon,
  Plan,
  parseAddresses,
  parseCoupons,
  parseOrder,
  parseOrdersPage,
  parsePlans,
} from '@features/payment/models/commerce.model';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NgpDialogManager } from 'ng-primitives/dialog';
// Dialog components load lazily (dynamic `import()` in the open* methods below), so
// they stay out of whichever chunk first injects this root facade.
import { Analytics } from '@core/services/analytics/analytics';

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

/** Only Stripe's hosted checkout may receive the learner, even though the URL comes from our API. */
const STRIPE_CHECKOUT_ORIGIN = 'https://checkout.stripe.com/';

/** The learner-facing reason K1 started no payment (`payment_error`). */
function paymentErrorMessage(code: string | null): string {
  switch (code) {
    case 'payment_unavailable_for_currency':
      return "Online payment isn't available for this currency yet.";
    case 'gateway_not_configured':
      return 'Payments are temporarily unavailable. Try again shortly.';
    default:
      return "We couldn't start the payment. Try again from your order.";
  }
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
  private readonly document = inject(DOCUMENT);

  /** The commerce cart. `CartStore` (core) owns it because the footer badge reads it too. */
  private readonly cart = inject(CartStore);
  private readonly auth = inject(AuthSession);
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

  /**
   * The order the invoice page shows (K4); `null` idles the read. Set through `loadOrder()`.
   * Gated on the boolean `isAuthenticated()`.
   */
  private readonly orderId = signal<string | null>(null);
  private readonly orderResource = httpResource(
    () => {
      const id = this.orderId();
      return id && this.auth.isAuthenticated()
        ? apiUrl(COMMERCE_ROUTES.order.path.replace(':order_id', id))
        : undefined;
    },
    { parse: parseOrder },
  );
  /** Guarded: `value()` throws on an errored resource. */
  readonly order = computed(() =>
    this.orderResource.hasValue() ? this.orderResource.value() : null,
  );
  readonly orderLoading = computed(() => this.orderResource.isLoading());
  readonly orderError = computed(() =>
    this.orderResource.error() ? "We couldn't load this order." : null,
  );
  private readonly orderErrorLog = effect(() => {
    const err = this.orderResource.error();
    if (err) this.logger.error('Failed to load the order', err);
  });

  /** A checkout or payment session is starting: Pay and Try again stay disabled meanwhile. */
  readonly paying = signal(false);

  /**
   * Order history (K3), newest first. OPT-IN: nothing is fetched until the orders page
   * calls `loadOrders()`. Gated on the boolean `isAuthenticated()`.
   *
   * ponytail: one page of 50 (CAIRA's maximum), no paging UI. Only subscriptions are sold,
   * so 50 orders is decades of renewals; add "Load more" on `next` if `ordersCount()`
   * ever exceeds `orders().length`.
   */
  private readonly ordersWanted = signal(false);
  private readonly ordersResource = httpResource(
    () =>
      this.ordersWanted() && this.auth.isAuthenticated()
        ? { url: apiUrl(COMMERCE_ROUTES.orders.path), params: { page_size: 50 } }
        : undefined,
    { parse: parseOrdersPage },
  );
  /** Guarded: `value()` throws on an errored resource. */
  readonly orders = computed(() =>
    this.ordersResource.hasValue() ? this.ordersResource.value().results : [],
  );
  readonly ordersCount = computed(() =>
    this.ordersResource.hasValue() ? this.ordersResource.value().count : 0,
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
   * The learner's addresses (A1). OPT-IN like the orders read: the billing and review
   * pages call `loadAddresses()`. Gated on the boolean `isAuthenticated()`.
   */
  private readonly addressesWanted = signal(false);
  private readonly addressesResource = httpResource(
    () =>
      this.addressesWanted() && this.auth.isAuthenticated()
        ? apiUrl(COMMERCE_ROUTES.addresses.path)
        : undefined,
    { parse: parseAddresses },
  );
  /**
   * `linkedSignal`, not `computed`: saving, editing and deleting an address patch this
   * list in place with the server's answer; a reload replaces it. Guarded, since
   * `value()` throws on an errored resource.
   */
  readonly addresses = linkedSignal<Address[]>(() =>
    this.addressesResource.hasValue() ? this.addressesResource.value() : [],
  );
  readonly addressesLoading = computed(() => this.addressesResource.isLoading());
  private readonly addressErrorLog = effect(() => {
    const err = this.addressesResource.error();
    if (err) this.logger.error('Failed to load addresses', err);
  });
  /**
   * The address picked on the billing page. It keeps the learner's pick while that
   * address exists, otherwise starts on the one already on the cart, then the default,
   * then the first. It reaches the cart only on Proceed (`attachBillingAddress`).
   */
  readonly selectedAddressId = linkedSignal<
    { list: Address[]; attached: string | null },
    string | null
  >({
    source: () => ({
      list: this.addresses(),
      attached: this.cart.cart()?.billing_address_id ?? null,
    }),
    computation: ({ list, attached }, previous) => {
      const has = (id: string | null | undefined) => !!id && list.some((a) => a.id === id);
      if (previous && has(previous.value)) return previous.value;
      if (has(attached)) return attached;
      return (list.find((a) => a.is_default) ?? list[0])?.id ?? null;
    },
  });
  isEditingAddress = signal<boolean>(false);
  /** An address save or update is in flight: the form waits for the answer, so a double click can't add two. */
  readonly savingAddress = signal(false);

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

  /**
   * The coupons the learner can apply (`commerce/coupons/`), each with what it saves on this cart,
   * in CAIRA's order. OPT-IN: the cart page calls `loadCoupons()`. Gated on the boolean
   * `isAuthenticated()` and on a cart with a line.
   *
   * Keyed on the cart's id (null while it has no line), not on the cart object: applying a coupon
   * or an address replaces the cart but changes nothing this list depends on. It is optional UI, so
   * it stays off the loading bar, and a failed read only logs: the code field still works.
   */
  private readonly couponsWanted = signal(false);
  private readonly couponCartId = computed(() => {
    const cart = this.cart.cart();
    return cart && cart.lines.length > 0 ? cart.id : null;
  });
  private readonly couponsResource = httpResource(
    () => {
      const cartId = this.couponCartId();
      return this.couponsWanted() && this.auth.isAuthenticated() && cartId
        ? {
            url: apiUrl(COMMERCE_ROUTES.coupons.path),
            params: { cart_id: cartId },
            headers: { 'X-Country-Code': this.country().toUpperCase() },
            context: new HttpContext().set(SKIP_LOADING, true),
          }
        : undefined;
    },
    { parse: parseCoupons },
  );
  /** Guarded: `value()` throws on an errored resource. */
  readonly coupons = computed<Coupon[]>(() =>
    this.couponsResource.hasValue() ? this.couponsResource.value() : [],
  );
  readonly couponsLoading = computed(() => this.couponsResource.isLoading());
  private readonly couponsErrorLog = effect(() => {
    const err = this.couponsResource.error();
    if (err) this.logger.error('Failed to load coupons', err);
  });

  /** The first call opts the coupon list in; later calls re-read it. */
  loadCoupons(): void {
    if (this.couponsWanted()) this.couponsResource.reload();
    else this.couponsWanted.set(true);
  }

  /** The first call opts the addresses in; later calls re-read them. */
  loadAddresses(): void {
    if (this.addressesWanted()) this.addressesResource.reload();
    else this.addressesWanted.set(true);
  }

  /** A2. Selects the new address, then `onDone` (the form closes only on success). */
  saveAddress(input: AddressInput, onDone: () => void): void {
    if (this.savingAddress()) return;
    this.savingAddress.set(true);
    this.http.call(COMMERCE_ROUTES.createAddress, input).subscribe({
      next: ({ data }) => {
        this.savingAddress.set(false);
        this.addresses.update((list) => [...list, data]);
        this.selectedAddressId.set(data.id);
        this.notification.success('Address saved', 'Your billing address was added.');
        onDone();
      },
      error: (err) => {
        this.savingAddress.set(false);
        this.logger.error('Failed to save the address', err);
        this.notification.error('Could not save the address', commerceErrorOf(err).message);
      },
    });
  }

  /** A4 (partial update), then `onDone`. */
  updateAddress(id: string, input: AddressInput, onDone: () => void): void {
    if (this.savingAddress()) return;
    this.savingAddress.set(true);
    const route = COMMERCE_ROUTES.updateAddress;
    this.http.call({ ...route, path: route.path.replace(':address_id', id) }, input).subscribe({
      next: ({ data }) => {
        this.savingAddress.set(false);
        this.addresses.update((list) => list.map((a) => (a.id === id ? data : a)));
        this.notification.success('Address updated', 'Your billing address was updated.');
        onDone();
      },
      error: (err) => {
        this.savingAddress.set(false);
        this.logger.error('Failed to update the address', err);
        this.notification.error('Could not update the address', commerceErrorOf(err).message);
      },
    });
  }

  /** A5. An address any order uses can't be deleted (409); the learner sees why. */
  deleteAddress(id: string): void {
    const route = COMMERCE_ROUTES.deleteAddress;
    this.http.call({ ...route, path: route.path.replace(':address_id', id) }).subscribe({
      next: () => {
        // `selectedAddressId` is linked to the list and moves off a deleted address by itself.
        this.addresses.update((list) => list.filter((a) => a.id !== id));
        // CAIRA clears the address from any cart that used it; mirror that, or the review
        // guard would pass on an address the server no longer has.
        const cart = this.cart.cart();
        if (cart?.billing_address_id === id) this.cart.set({ ...cart, billing_address_id: null });
        this.notification.success('Address deleted', 'The address was removed.');
      },
      error: (err) => {
        this.logger.error('Failed to delete the address', err);
        this.notification.error('Could not delete the address', commerceErrorOf(err).message);
      },
    });
  }

  /**
   * C5: puts the selected address on the cart as its billing address, then `onAttached`
   * (the billing page moves on to review). Checkout copies it onto the order.
   */
  attachBillingAddress(onAttached: () => void): void {
    const cartId = this.cart.cart()?.id;
    const addressId = this.selectedAddressId();
    if (!cartId || !addressId) {
      this.notification.error('Billing address needed', 'Select or add a billing address.');
      return;
    }
    this.http
      .call(COMMERCE_ROUTES.attachAddress, { cart_id: cartId, billing_address_id: addressId })
      .subscribe({
        next: ({ data }) => {
          this.cart.set(data);
          onAttached();
        },
        error: (err) => {
          this.logger.error('Failed to attach the billing address', err);
          this.notification.error('Could not use this address', commerceErrorOf(err).message);
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

  /**
   * K1: turns the reviewed cart into a pending order and starts its first Stripe session.
   * Exactly one outcome comes back, tested in this order:
   * - `free_order`: a coupon covered it and the order is already paid;
   * - `payment`: the browser goes to Stripe's hosted checkout;
   * - `payment_error`: the order exists but no session started. The learner lands on the
   *   order with the reason and a "Try again" (K2); retrying here would fail the same way.
   * `onOrder` opens the order's page; the facade doesn't know the route.
   */
  checkout(onOrder: (orderId: string) => void): void {
    const cartId = this.cart.cart()?.id;
    if (!cartId || this.paying()) return;
    this.paying.set(true);

    this.http.call(COMMERCE_ROUTES.checkout, { cart_id: cartId }).subscribe({
      next: ({ data }) => {
        this.analytics.trackEvent('begin_checkout', {
          cart_id: cartId,
          ...this.cartAnalyticsParams(),
        });
        if (data.free_order) {
          this.paying.set(false);
          onOrder(data.result.id);
        } else if (data.payment) {
          this.redirectToStripe(data.payment.url);
        } else {
          this.paying.set(false);
          this.notification.error('Payment not started', paymentErrorMessage(data.payment_error));
          onOrder(data.result.id);
        }
      },
      error: (err) => {
        this.paying.set(false);
        this.logger.error('Checkout failed', err);
        this.notification.error('Checkout failed', commerceErrorOf(err).message);
      },
    });
  }

  /**
   * K2: a new Stripe session for an order that is still payable (after a cancel, an expired
   * session, or a `payment_error`). CAIRA expires any older session first, so the learner
   * can't pay twice. A coupon-zeroed order completes without Stripe, so the order is re-read.
   */
  retryPayment(orderId: string): void {
    if (this.paying()) return;
    this.paying.set(true);
    this.http.call(COMMERCE_ROUTES.paymentSession, { order_id: orderId }).subscribe({
      next: ({ data }) => {
        if ('url' in data) {
          this.redirectToStripe(data.url);
          return;
        }
        this.paying.set(false);
        this.loadOrder(orderId);
      },
      error: (err) => {
        this.paying.set(false);
        this.logger.error('Could not start the payment', err);
        this.notification.error('Payment not started', commerceErrorOf(err).message);
        // The order moved on (paid, cancelled) since this page read it.
        if (commerceErrorOf(err).reason === 'order_not_payable') this.loadOrder(orderId);
      },
    });
  }

  /** The URL comes from our API, but it is still a redirect target: Stripe's hosted checkout only. */
  private redirectToStripe(url: string): void {
    if (!url.startsWith(STRIPE_CHECKOUT_ORIGIN)) {
      this.paying.set(false);
      this.logger.error('Refused a payment redirect outside Stripe checkout', url);
      this.notification.error('Payment not started', "We couldn't open the payment page.");
      return;
    }
    // `paying` stays set: the page is leaving.
    this.document.location.assign(url);
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

  /** First call opts the orders page in; later calls (retry, after a mutation) refetch. */
  loadOrders() {
    if (this.ordersWanted()) this.ordersResource.reload();
    else this.ordersWanted.set(true);
  }

  /** Points the order read at `orderId`; the same id again re-reads it. */
  loadOrder(orderId: string): void {
    if (this.orderId() === orderId) this.orderResource.reload();
    else this.orderId.set(orderId);
  }
}

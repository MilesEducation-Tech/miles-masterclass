import {
  DestroyRef,
  inject,
  Service,
  signal,
  computed,
  effect,
  linkedSignal,
  Injector,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { RouteResponse } from '@core/models/http.model';
import {
  CartDetails,
  PAYMENT_ROUTES,
  CouponList,
  CouponListResponse,
  BillingAddressPayload,
  UserAddress,
  OrderByIdResponseData,
  PlanPriceDetail,
  SubscriptionPlan,
} from '@core/models/payment.model';
import { PROFILE_ROUTES, ProfileFormState } from '@core/models/profile.model';
import { User } from '@core/models/profile.model';
import { NotificationService } from '@core/services/notification/notification';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { CartStore } from '@core/services/cart/cart-store';
import { NgpDialogManager } from 'ng-primitives/dialog';
// Dialog components are loaded lazily (dynamic import in the open* methods below)
// so they — and their `@angular/forms` dependency — stay out of the initial
// bundle. This facade is eagerly instantiated via the root `Utils` service, so a
// static import would drag every dialog into the initial chunk. Types are
// import-only (erased at build time); the runtime class comes from `import()`.
import type { CouponDialogData } from '@features/payment/dialogs/coupon-dialog/coupon-dialog';
import type {
  FirmSponsorshipDialogData,
  FirmSponsorshipResult,
} from '@features/payment/dialogs/firm-sponsorship-dialog/firm-sponsorship-dialog';
import type { PartnerCodePromptResult } from '@features/payment/dialogs/partner-code-prompt-dialog/partner-code-prompt-dialog';
import { Analytics } from '@core/services/analytics/analytics';

type MyBucketResponse = RouteResponse<typeof PAYMENT_ROUTES.myBucket>;
type ListAddressResponse = RouteResponse<typeof PAYMENT_ROUTES.listAddress>;
type AddAddressResponse = RouteResponse<typeof PAYMENT_ROUTES.addAddress>;
type CheckoutResponse = RouteResponse<typeof PAYMENT_ROUTES.proceedToPayment>;
type OrderByIdResponse = RouteResponse<typeof PAYMENT_ROUTES.getOrderById>;
type OrdersResponse = RouteResponse<typeof PAYMENT_ROUTES.getOrders>;
type CancelAutoRenewalResponse = RouteResponse<typeof PAYMENT_ROUTES.cancelAutoRenewal>;
type ReactivateAutoRenewalResponse = RouteResponse<typeof PAYMENT_ROUTES.reactivateAutoRenewal>;
type StripePortalResponse = RouteResponse<typeof PAYMENT_ROUTES.navigateToStripeCustomerDashboard>;
type SubscriptionPlansResponse = RouteResponse<typeof PAYMENT_ROUTES.getSubscriptionPlans>;

@Service()
export class PaymentFacade {
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly http = inject(ApiClient);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly analytics = inject(Analytics);

  /**
   * Cart state lives in `CartStore` (core) because the footer overlay (layout)
   * and two offerings facades (feature) read it, and PROMPT.md §3 lets neither
   * import this feature. These are aliases, not copies — same signal objects —
   * so every existing call site here and in the payment pages is unchanged.
   */
  private readonly cart = inject(CartStore);
  readonly cartItemRemoved = this.cart.cartItemRemoved;
  readonly cartData = this.cart.cartData;

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
  readonly cartFetched = this.cart.cartFetched;

  /**
   * `loading` / `error` are NOT cart-only, and that only became visible when the
   * cart fetch moved to an `httpResource` in Phase 9.
   *
   * They used to be plain writable signals owned by `CartStore`, and this facade
   * wrote them for things that have nothing to do with the cart bucket:
   * `proceedToPayment()` and the order-detail read both drive them. `CartStore`'s half
   * is now derived from its resource and therefore read-only, so this facade keeps
   * its own writable pair for the checkout POST, and the order read (now a resource
   * too) joins the OR below.
   *
   * The OR is what preserves existing behaviour rather than quietly narrowing it:
   * `paymentGuard` and `cartResolver` wait on `loading`, so today they also wait
   * out a checkout POST. Deriving `loading` from the cart resource alone would have
   * silently stopped that. If that wait turns out to be unwanted, it is a separate,
   * deliberate change — not a side effect of a data-layer refactor.
   */
  private readonly opLoading = signal(false);
  private readonly opError = signal<string | null>(null);
  // The order read joins the OR too: it used to drive `opLoading`/`opError` by hand,
  // and the invoice skeleton, `cartResolver` and `paymentGuard` all read these.
  readonly loading = computed(
    () => this.cart.loading() || this.opLoading() || this.orderResource.isLoading(),
  );
  readonly error = computed(
    () =>
      this.cart.error() ??
      this.opError() ??
      (this.orderResource.error() ? 'Failed to load order details' : null),
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
   * Subscription plans: the plan page's full list and the subscription dialog's
   * recommended-only slice, as two OPT-IN resources so neither clobbers the other.
   *
   * SSR: the plan page renders on the server. Angular's HTTP transfer cache hands
   * an anonymous server fetch to the browser; a signed-in one carries
   * `Authorization`, which that cache skips, so the browser fetches the plans once
   * more. That replaced a hand-rolled TransferState handoff, a trade-off accepted
   * in docs/refactor/STATE.md "Decisions" (Phase 9 payment).
   */
  private readonly plansWanted = signal(false);
  private readonly recommendedWanted = signal(false);
  private readonly plansResource = httpResource<SubscriptionPlansResponse>(() =>
    this.plansWanted() ? apiUrl(PAYMENT_ROUTES.getSubscriptionPlans.path) : undefined,
  );
  private readonly recommendedResource = httpResource<SubscriptionPlansResponse>(() =>
    this.recommendedWanted()
      ? {
          url: apiUrl(PAYMENT_ROUTES.getSubscriptionPlans.path),
          params: { is_recommended: 'true' },
        }
      : undefined,
  );
  /**
   * `linkedSignal`, not `computed`: adding a plan to the cart and removing it patch
   * `is_added_to_cart` in place; a reload replaces the list. Guarded, since `value()`
   * throws on an errored resource.
   */
  readonly subscriptionPlans = linkedSignal<SubscriptionPlan[]>(() =>
    this.plansResource.hasValue() ? (this.plansResource.value()?.data ?? []) : [],
  );
  readonly plansLoading = computed(() => this.plansResource.isLoading());
  readonly plansError = computed(() =>
    this.plansResource.error() ? 'Failed to load subscription plans' : null,
  );
  readonly recommendedPlans = computed<SubscriptionPlan[]>(() =>
    this.recommendedResource.hasValue() ? (this.recommendedResource.value()?.data ?? []) : [],
  );
  readonly recommendedPlansLoading = computed(() => this.recommendedResource.isLoading());
  readonly recommendedPlansError = computed(() =>
    this.recommendedResource.error() ? 'Failed to load subscription plans' : null,
  );
  private readonly plansErrorLog = effect(() => {
    const err = this.plansResource.error() ?? this.recommendedResource.error();
    if (err) this.logger.error('Failed to load subscription plans', err);
  });

  hasCartItems = computed(() => {
    const data = this.cartData();
    return data ? data.cartitem_data.length > 0 : false;
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

  cartState = computed(() => {
    const data = this.cartData();
    if (!data) return { hasCourses: false, hasSubscription: false, isMixedCart: false };

    let hasCourses = false;
    let hasSubscription = false;

    for (const item of data.cartitem_data) {
      if (item.item_details.delivery_mode === 'subscription') {
        hasSubscription = true;
      } else {
        hasCourses = true;
      }

      if (hasCourses && hasSubscription) break; // Optimization: Stop checking if both are true
    }

    return {
      hasCourses,
      hasSubscription,
      isMixedCart: hasCourses && hasSubscription,
    };
  });

  /** Single write-point for the cart signal; the signal itself is `CartStore`'s. */
  private setCartData(cart: CartDetails | null): void {
    this.cart.setCartData(cart);
  }

  /** Delegates to `CartStore`; see the note on `cartData`. */
  loadMyBucket(options: { force?: boolean } = {}): void {
    this.cart.loadMyBucket(options);
  }

  loadBillingAddress() {
    if (this.cartState().isMixedCart) {
      this.notification.info(
        'Cart contains a subscription along with other courses.',
        'After purchasing a subscription, most courses will be accessible at no additional cost. Please remove either all courses or the subscription to proceed.',
      );
      return;
    }
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

  removeCoursesFromCart() {
    // Placeholder for API call to remove all course items
  }

  removeCartItem(cartitemId: number) {
    const removedItem = this.cartData()?.cartitem_data?.find((item) => item.id === cartitemId);

    this.http
      .post<MyBucketResponse>(PAYMENT_ROUTES.removeBucketItem.path, { cartitem_id: cartitemId })
      .subscribe({
        next: (res) => {
          this.setCartData(res?.data ?? null);
          this.notification.success('Success', 'Item removed from cart');

          if (removedItem) {
            this.cartItemRemoved.set(removedItem.item_details.id);
          }

          // Reset is_added_to_cart on subscription plans if the removed item was a subscription
          this.subscriptionPlans.update((plans) =>
            plans.map((p) => (p.is_added_to_cart ? { ...p, is_added_to_cart: false } : p)),
          );
        },
        error: (err) => {
          this.logger.error('Failed to remove cart item', err);
        },
      });
  }

  getCoupons() {
    return this.http.get<CouponListResponse>(PAYMENT_ROUTES.listCoupon.path);
  }

  /** Cached coupon list backing the cart's inline "first coupon" strip. */
  readonly coupons = signal<CouponList[]>([]);
  private couponsLoaded = false;

  loadCoupons(): void {
    if (this.couponsLoaded) return;
    this.couponsLoaded = true;
    this.getCoupons().subscribe({
      next: (res) => this.coupons.set(res.data ?? []),
      error: () => this.coupons.set([]),
    });
  }

  applyCoupon(couponCode: string) {
    return this.http
      .post<MyBucketResponse>(PAYMENT_ROUTES.applyCoupon.path, { coupon_code: couponCode })
      .pipe(
        tap({
          next: (res) => {
            this.setCartData(res?.data ?? null);
            this.notification.success(
              'Coupon Applied',
              'The coupon has been applied to your cart.',
            );
          },
          error: (err) => {
            this.logger.error('Failed to apply coupon', err);
          },
        }),
      );
  }

  removeCoupon(couponCode: string) {
    this.http
      .post<MyBucketResponse>(PAYMENT_ROUTES.removeCoupon.path, { coupon_code: couponCode })
      .subscribe({
        next: (res) => {
          this.setCartData(res?.data ?? null);
          this.notification.success('Success', 'Coupon removed successfully');
        },
        error: (err) => {
          this.logger.error('Failed to remove coupon', err);
        },
      });
  }

  async openCouponDialog(): Promise<void> {
    const cartData = this.cartData();
    if (!cartData) return;

    const { CouponDialog } = await import('@features/payment/dialogs/coupon-dialog/coupon-dialog');
    const dialogRef = this.dialogs.open<CouponDialogData, CartDetails | undefined>(CouponDialog, {
      data: { cartData },
      injector: this.injector,
    });

    dialogRef.afterClosed.subscribe((updatedCart) => {
      if (updatedCart) {
        this.setCartData(updatedCart);
      }
    });
  }

  async openFirmSponsorshipDialog(
    plan: SubscriptionPlan,
    paymentType: 'monthly' | 'yearly' = 'yearly',
  ): Promise<void> {
    const { FirmSponsorshipDialog } =
      await import('@features/payment/dialogs/firm-sponsorship-dialog/firm-sponsorship-dialog');
    const dialogRef = this.dialogs.open<
      FirmSponsorshipDialogData,
      FirmSponsorshipResult | undefined
    >(FirmSponsorshipDialog, {
      data: { planId: plan.id, planName: plan.subscription_name },
      injector: this.injector,
    });

    dialogRef.afterClosed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) return;

      if (result.skipped) {
        this.addToCart(plan.id, 'subscription', plan.price_detail, paymentType);
        return;
      }

      // Only patch the profile when the user picked a different company than the
      // one already on their profile (or had none before).
      // ponytail: the existing company came from the removed session service,
      // so any pick now counts as a change.
      const existingCompanyId: number | null = null;
      const companyChanged = !!result.companyId && result.companyId !== existingCompanyId;

      // Step 1 — submit the sponsorship request. Step 2 (optional) — patch
      // profile with the new company. Each stage has its own catchError so a
      // profile-patch failure can't masquerade as a sponsorship failure (and
      // vice versa); sponsorship success toast is independent of whether the
      // follow-up profile update succeeds.
      this.http
        .post<unknown>(PROFILE_ROUTES.applyFirmSponsorship.path, {
          company_id: result.companyId,
          consent_given: result.consent,
          subscription_id: plan.id,
          ld_spoc_email: result.spocEmail,
        })
        .pipe(
          catchError((err) => {
            this.logger.error('Failed to submit firm sponsorship', err);
            this.notification.error(
              'Sponsorship Failed',
              'We could not submit your sponsorship request. Please try again.',
            );
            return EMPTY;
          }),
          tap(() =>
            this.notification.success(
              'Sponsorship Request Submitted',
              "We'll reach out to your firm's L&D team on your behalf.",
            ),
          ),
          switchMap(() => {
            if (!companyChanged) return EMPTY;
            const payload: Partial<ProfileFormState> = { company_id: result.companyId };
            return this.http
              .patch<{
                user: User;
                message: string;
                status: boolean;
              }>(PROFILE_ROUTES.saveProfile.path, payload)
              .pipe(
                catchError((err) => {
                  // Sponsorship already succeeded — don't undo that toast.
                  this.logger.error('Profile update after sponsorship failed', err);
                  return EMPTY;
                }),
              );
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        // ponytail: pushed the patched profile back into the session service.
        .subscribe();
    });
  }

  proceedToPayment(isTrial = false) {
    const cartId = this.cartData()?.cart_id;
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

  addToCart(
    itemId: number,
    itemType: 'subscription' | 'masterclass' | 'podcast' | 'nano-learning' | 'webinar',
    priceDetail?: PlanPriceDetail | null,
    paymentType: 'monthly' | 'yearly' = 'yearly',
    // Runs after a successful add instead of opening the cart drawer. The plan
    // page passes a navigate-to-cart-page callback; other callers get the drawer.
    onAdded?: () => void,
  ) {
    this.http
      .post<MyBucketResponse>(PAYMENT_ROUTES.addBucketItem.path, {
        item_id: itemId,
        item_type: itemType,
        pay_method: paymentType,
      })
      .subscribe({
        next: (res) => {
          const cartData = res?.data ?? null;
          this.setCartData(cartData);
          this.notification.success('Success', 'Item added to cart');
          this.analytics.trackEvent('add_to_cart', {
            course_id: itemId,
            course_type: itemType,
            base_price: priceDetail?.base_price,
            selling_price: priceDetail?.selling_price,
            product_discount: priceDetail?.discount,
            items: [
              {
                course_id: String(itemId),
                course_type: itemType,
                price: priceDetail?.selling_price,
              },
            ],
          });

          // Update is_added_to_cart on the matching plan
          this.subscriptionPlans.update((plans) =>
            plans.map((p) => (p.id === itemId ? { ...p, is_added_to_cart: true } : p)),
          );

          // Force-refresh so the drawer/cart reflects server-side totals (taxes,
          // discounts, etc.) that the add-item response may not include.
          this.loadMyBucket({ force: true });
          if (onAdded) onAdded();
          else this.openCartDrawer();
        },
        error: (err) => {
          this.logger.error('Failed to add item to cart', err);
        },
      });
  }

  /**
   * Pricing + items snapshot of the current cart, shared by the `cart_view`
   * and `begin_checkout` events. `base_price`/`selling_price` are summed across
   * cart items; `product_discount` is the cart-level discount total.
   */
  private cartAnalyticsParams(pageName?: string): Record<string, unknown> {
    const cart = this.cartData();
    const items = cart?.cartitem_data ?? [];
    return {
      ...(pageName ? { page_name: pageName } : {}),
      base_price: items.reduce((sum, i) => sum + (i.base_price ?? 0), 0),
      selling_price: items.reduce((sum, i) => sum + (i.selling_price ?? 0), 0),
      product_discount: cart?.total_discount_amount ?? 0,
      items: items.map((i) => ({
        course_id: String(i.id),
        course_type: i.item_type ?? '',
        price: i.selling_price,
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

  /**
   * Subscribe-flow entry for the recommended plan. Opens the partner-code
   * prompt and dispatches based on the user's choice:
   *  - `subscribe`              → proceed with the normal add-to-cart flow.
   *  - `partner-code-applied`   → the PartnerCode service already refreshed the
   *                                profile (and, through it, the active plan)
   *                                and showed a success toast. When the caller
   *                                is showing the subscription plan list (the
   *                                plan page), `refreshPlansOnApply` re-fetches
   *                                it so partner-driven eligibility/pricing
   *                                changes are reflected in place.
   *  - `closed`                 → no-op (user dismissed the prompt).
   *
   * `refreshPlansOnApply` is opt-in because this method is shared with the
   * onboarding subscription dialog, which loads a `recommendedOnly` slice and
   * closes itself on subscribe — an unconditional full-list refresh would
   * clobber that slice in the shared `subscriptionPlans` signal.
   *
   * If the plan is already in the cart, skip the prompt and just open the
   * cart drawer — matches the existing non-recommended path.
   */
  async promptPartnerCodeOrSubscribe(
    plan: SubscriptionPlan,
    options: {
      refreshPlansOnApply?: boolean;
      paymentType?: 'monthly' | 'yearly';
      onAdded?: () => void;
    } = {},
  ): Promise<void> {
    const paymentType = options.paymentType ?? 'yearly';
    if (plan.is_added_to_cart) {
      this.loadMyBucket({ force: true });
      if (options.onAdded) options.onAdded();
      else this.openCartDrawer();
      return;
    }

    // A partner code already applied to this plan makes the prompt pointless —
    // skip it and go straight to the normal flow.
    // ponytail: also skipped on an active subscription, read from the removed
    // session service.
    if (plan.is_partner_code_applied) {
      this.addToCart(plan.id, 'subscription', plan.price_detail, paymentType, options.onAdded);
      return;
    }

    const { PartnerCodePromptDialog } =
      await import('@features/payment/dialogs/partner-code-prompt-dialog/partner-code-prompt-dialog');
    const ref = this.dialogs.open<undefined, PartnerCodePromptResult>(PartnerCodePromptDialog, {
      injector: this.injector,
    });

    ref.afterClosed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.action === 'subscribe') {
        this.addToCart(plan.id, 'subscription', plan.price_detail, paymentType, options.onAdded);
      } else if (result?.action === 'partner-code-applied' && options.refreshPlansOnApply) {
        this.loadSubscriptionPlans();
      }
    });
  }

  /** First call opts a list in; later calls (retry, partner code applied) refetch it. */
  loadSubscriptionPlans(options: { recommendedOnly?: boolean } = {}) {
    const [wanted, resource] = options.recommendedOnly
      ? [this.recommendedWanted, this.recommendedResource]
      : [this.plansWanted, this.plansResource];
    if (wanted()) resource.reload();
    else wanted.set(true);
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

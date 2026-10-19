import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  injectAsync,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PaymentStatus } from '@features/payment/components/payment-status/payment-status';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { CartStore } from '@core/services/cart/cart-store';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { formatAddress } from '@features/payment/utils/address-format';
import { paymentDisplayStatus } from '@features/payment/utils/order-status';
import { CartDisplayItem, CartItem } from '@features/payment/components/cart-item/cart-item';
import { PriceOverview } from '@features/payment/components/price-overview/price-overview';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Utils } from '@shared/services/utils';
import { Analytics } from '@core/services/analytics/analytics';
import { Button } from '@shared/ui/button/button';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowDownTray, heroChevronLeft } from '@ng-icons/heroicons/outline';
import { NotificationService } from '@core/services/notification/notification';
import { DatePipe } from '@angular/common';
import { NgpDialogManager } from 'ng-primitives/dialog';
// Type-only: UtilsDialog loads with `import()` when opened (PROMPT.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';

@Component({
  selector: 'app-invoice',
  imports: [
    PaymentStatus,
    CartItem,
    PriceOverview,
    ErrorState,
    Button,
    NgIconComponent,
    DatePipe,
    RouterLink,
  ],
  templateUrl: './invoice.html',
  providers: [provideIcons({ heroChevronLeft, heroArrowDownTray })],
  host: {
    class: 'relative',
  },
})
export class Invoice {
  private readonly facade = inject(PaymentFacade);
  private readonly auth = inject(AuthSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly analytics = inject(Analytics);
  private readonly destroyRef = inject(DestroyRef);
  private readonly utils = inject(Utils);
  private readonly notification = inject(NotificationService);
  // Lazy — jspdf + html2canvas-pro (the bulk of the invoice chunk) load only
  // when the user actually downloads, not on page render. See injectAsync docs.
  private readonly pdfService = injectAsync(() =>
    import('@core/services/html-to-pdf/html-to-pdf').then((m) => m.HtmlToPdf),
  );
  private readonly dialogs = inject(NgpDialogManager);

  readonly invoiceContent = viewChild<ElementRef<HTMLElement>>('invoiceContent');

  readonly orderId = input<string>();

  readonly isInvoice = computed(() => this.utils.currentUrl()?.includes('/invoice') ?? false);

  /** `/:country/:profession_type` prefix used by the legal/FAQ deep-links below. */
  protected readonly basePath = computed(
    () => `/${this.utils.country()}/${this.utils.profession()}`,
  );
  protected readonly termsRoute = computed(() => `${this.basePath()}/terms-of-service`);
  protected readonly faqRoute = computed(() => `${this.basePath()}/faq`);
  protected readonly cartRoute = computed(() => `${this.basePath()}/payment/cart`);

  /** Review mode shows the cart; invoice mode shows the order (K4). */
  private readonly cart = inject(CartStore).cart;
  protected readonly order = this.facade.order;
  protected readonly paying = this.facade.paying;

  /**
   * Shimmer while the order read is in flight, and in the gap before it starts, so the
   * empty invoice never paints for a frame. An error falls through to the page.
   */
  readonly showSkeleton = computed(
    () =>
      this.isInvoice() &&
      !this.facade.orderError() &&
      (this.facade.orderLoading() || this.order() === null),
  );
  /**
   * The order read failed (invoice mode only: the root facade keeps the last order read's
   * state, and review shows the cart, not an order).
   */
  readonly loadError = computed(() => (this.isInvoice() ? this.facade.orderError() : null));

  readonly itemCount = computed(() =>
    this.isInvoice() ? (this.order()?.lines.length ?? 0) : (this.cart()?.lines.length ?? 0),
  );

  readonly cartItems = computed<CartDisplayItem[]>(() =>
    this.isInvoice() ? (this.order()?.lines ?? []) : (this.cart()?.lines ?? []),
  );

  /** The billing address on the order (invoice) or on the cart (review), from the learner's list. */
  readonly billingAddress = computed(() => {
    const id = this.isInvoice()
      ? this.order()?.billing_address_id
      : this.cart()?.billing_address_id;
    return this.facade.addresses().find((a) => a.id === id) ?? null;
  });
  readonly formattedAddress = computed(() => {
    const address = this.billingAddress();
    return address ? formatAddress(address) : '';
  });

  /** Review: the address Pay would put on the cart, summarised above the terms. Optional. */
  protected readonly selectedAddress = this.facade.selectedAddress;
  protected readonly addressesLoading = this.facade.addressesLoading;
  protected readonly formatAddress = formatAddress;

  readonly currencyCode = computed(() =>
    this.isInvoice() ? (this.order()?.currency ?? '') : (this.cart()?.currency ?? ''),
  );

  /** The payment attempt the invoice cites: the successful one, else the latest. */
  readonly payment = computed(() => {
    const payments = this.order()?.payments ?? [];
    return payments.find((p) => p.status === 'succeeded') ?? payments[0] ?? null;
  });

  /** `?status=` from the URL: our Stripe-return redirect's hint, used until the order loads. */
  private readonly urlStatus = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('status'))),
  );

  readonly paymentStatus = computed(() =>
    paymentDisplayStatus(this.order()?.status ?? this.urlStatus()),
  );

  /** An order still waiting for money can start a new Stripe session (K2). */
  readonly canRetry = computed(() => {
    const status = this.order()?.status;
    return this.isInvoice() && (status === 'pending' || status === 'failed');
  });

  readonly termsAccepted = signal(false);

  /**
   * Pay waits for the terms, a closed address form, and no checkout already in flight. The
   * billing address is optional: CAIRA checks out without one.
   */
  readonly canPay = computed(
    () => this.termsAccepted() && !this.paying() && !this.facade.isEditingAddress(),
  );

  /** Placeholder row count for the loading skeleton — no meaning beyond "a few". */
  protected readonly skeletonRows = [0, 1, 2];

  constructor() {
    // Both modes show the billing address by id, so both need the learner's address list.
    this.facade.loadAddresses();

    effect(() => {
      const orderId = this.orderId();
      if (!orderId) return;
      // An order is the learner's own: signed out (say, a session that lapsed during Stripe
      // checkout), sign in first and come straight back, instead of an endless skeleton.
      if (!this.auth.isAuthenticated()) {
        void this.router.navigate(['/auth/login'], { queryParams: { redirect: this.router.url } });
        return;
      }
      this.facade.loadOrder(orderId);
    });

    // Keep `?status=` in step with the order, so a shared or refreshed URL reads right. Invoice
    // only: the root facade still holds the last order on review, which shows the cart instead.
    effect(() => {
      const status = this.isInvoice() ? this.order()?.status : undefined;
      if (!status) return;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    // ponytail: two effects here needed the session layer — one bounced the
    // user home on logout, the other refreshed the current plan on the
    // payment-success edge so the header's `hasActivePlan` flipped at once.

    // Fire GA4/Netcore `purchase` once the order is paid. trackPurchase dedupes by
    // transaction_id, so a refresh of the success URL can't double-count revenue.
    let purchaseSent: string | null = null;
    effect(() => {
      const order = this.order();
      if (!order || order.status !== 'paid' || purchaseSent === order.id) return;
      purchaseSent = order.id;
      // GA needs numbers; the server's figures are converted here and nothing is summed.
      this.analytics.trackPurchase({
        transaction_id: order.id,
        value: Number(order.money.price_after_gst),
        currency: order.currency,
        base_price: Number(order.money.price_before_discount),
        selling_price: Number(order.money.price_after_gst),
        product_discount: Number(order.money.discount_amount),
        paid_amount: Number(order.money.amount_paid),
        items: order.lines.map((line) => ({
          course_id: line.product_id,
          course_type: 'subscription',
          price: Number(line.money.final_amount),
        })),
      });
    });
  }

  /** Only subscriptions are sold, so any cart line means the auto-renewal terms apply. */
  readonly hasSubscriptionItem = computed(
    () => !this.isInvoice() && (this.cart()?.lines.length ?? 0) > 0,
  );

  async proceedToPayment() {
    if (!this.termsAccepted()) {
      this.notification.error('', 'Please accept the terms and conditions to proceed.');
      return;
    }

    if (!this.hasSubscriptionItem()) {
      this.pay();
      return;
    }

    const dialogData: UtilsDialogData = {
      title: 'Subscription Auto-Renewal Terms & Conditions',
      containerClass: 'max-w-lg text-left!',
      content: [
        {
          type: 'list',
          items: [
            'Your subscription will automatically renew at the end of each billing cycle unless canceled before the renewal date.',
            'The renewal charge will be automatically deducted from your saved payment method.',
            'You can cancel auto-renewal anytime through your account settings.',
            'No refunds will be provided for partial or unused subscription periods.',
            'By subscribing, you agree to our Terms & Conditions and Refund Policy.',
          ],
        },
      ],
      buttons: [
        // `link`, not `ghost`: no hover fill (the ghost variant paints a navy `bg-muted` block).
        { label: 'Close', variant: 'link', action: 'close' },
        { label: 'Proceed to Payment', variant: 'default', action: 'confirm' },
      ],
    };

    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: { ...dialogData, maxWidth: '32rem', disableClose: true },
    });

    ref.afterClosed.subscribe((result) => {
      if (result?.action === 'confirm' && result.result) {
        this.pay();
      }
    });
  }

  /**
   * K1, once a picked address is on the cart (checkout copies it onto the order); with none
   * picked, K1 straight away. Stripe takes over from there, or the order's own page opens
   * (free, or no session).
   */
  private pay(): void {
    const checkout = () =>
      this.facade.checkout((orderId) =>
        this.router.navigate([`${this.basePath()}/payment/invoice`, orderId]),
      );
    const picked = this.facade.selectedAddressId();
    if (picked && picked !== this.cart()?.billing_address_id) {
      this.facade.attachBillingAddress(checkout);
    } else {
      checkout();
    }
  }

  protected openAddressDialog(): void {
    void this.facade.openAddressDialog();
  }

  protected retry(): void {
    const id = this.order()?.id;
    if (id) this.facade.retryPayment(id);
  }

  protected retryLoadOrder(): void {
    const id = this.orderId();
    if (id) this.facade.loadOrder(id);
  }

  async downloadInvoice() {
    const el = this.invoiceContent()?.nativeElement;
    if (!el) return;

    const pdf = await this.pdfService();
    await pdf.convertToPdf(el, {
      filename: `invoice-${this.orderId() || 'document'}.pdf`,
      // One page sized to the invoice — no A4 letterboxing, no page breaks mid-item
      pageSize: 'Auto',
      imageQuality: 0.92,
      exclude: { classes: ['no-print'] },
    });
  }
}

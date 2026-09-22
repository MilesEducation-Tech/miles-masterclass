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
import { PaymentStatus } from '../../components/payment-status/payment-status';
import { PaymentFacade } from '../../service/payment-facade/payment-facade';
import { CartItem } from '../../components/cart-item/cart-item';
import { PriceOverview } from '../../components/price-overview/price-overview';
import { Utils } from '@shared/services/utils';
import { Analytics } from '@core/services/analytics/analytics';
import { Button } from '@shared/ui/button/button';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowDownTray, heroChevronLeft } from '@ng-icons/heroicons/outline';
import { NotificationService } from '@core/services/notification/notification';
import { DatePipe } from '@angular/common';
import { Dialog } from '@core/services/dialog/dialog';
import { UtilsDialog, UtilsDialogData } from '@shared/dialogs/utils-dialog/utils-dialog';

@Component({
  selector: 'app-invoice',
  imports: [PaymentStatus, CartItem, PriceOverview, Button, NgIconComponent, DatePipe, RouterLink],
  templateUrl: './invoice.html',
  styleUrl: './invoice.css',
  providers: [provideIcons({ heroChevronLeft, heroArrowDownTray })],
  host: {
    class: 'relative',
  },
})
export class Invoice {
  private readonly facade = inject(PaymentFacade);
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
  private readonly dialog = inject(Dialog);

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

  readonly cartData = computed(() => this.facade.cartData());
  readonly orderData = computed(() => this.facade.orderData());

  /**
   * Shimmer while the order fetch is in flight. Also covers the gap before
   * `loadOrderById` flips `loading` — otherwise the empty invoice paints for a
   * frame first. Errors fall through so the page renders instead of shimmering
   * forever.
   */
  readonly showSkeleton = computed(
    () =>
      this.isInvoice() &&
      !this.facade.error() &&
      (this.facade.loading() || this.orderData() === null),
  );

  readonly itemCount = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceItemCount();
    }
    return this.cartData()?.cartitem_data.length ?? 0;
  });

  readonly cartItems = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceItems();
    }
    return this.cartData()?.cartitem_data ?? [];
  });

  // ponytail: was the signed-in user's name/email/mobile on the invoice.
  readonly userData = computed(() => ({ name: '', email: '', mobile: '' }));

  readonly formattedAddress = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceFormattedAddress();
    }
    const a = this.facade
      .billingAddress()
      .find((addr) => addr.id === this.facade.selectedAddressId());
    return [a?.address1, a?.locality, a?.landmark, a?.city, a?.state, a?.country, a?.zipcode]
      .filter(Boolean)
      .join(', ');
  });

  readonly currencyCode = computed(() => {
    if (this.isInvoice()) {
      return this.facade.invoiceCurrency();
    }
    return this.cartData()?.selected_country?.currency ?? 'USD';
  });

  /** ?status= query param from the URL (e.g. /invoice/3098?status=Success) */
  private readonly urlStatus = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('status'))),
  );

  readonly paymentStatus = computed<'success' | 'pending' | 'cancelled'>(() => {
    const apiStatus = this.facade.invoicePaymentStatus();
    // API is the source of truth; URL param is only used while API hasn't loaded yet
    const raw = apiStatus ?? this.urlStatus();

    switch (raw?.toLowerCase()) {
      case 'success':
      case 'completed':
        return 'success';
      case 'failed':
        return 'cancelled';
      case 'pending':
        return 'pending';
      default:
        // No URL param and API hasn't loaded yet — show pending until API responds
        return 'pending';
    }
  });

  readonly termsAccepted = signal(false);

  /** Placeholder row count for the loading skeleton — no meaning beyond "a few". */
  protected readonly skeletonRows = [0, 1, 2];

  constructor() {
    effect(() => {
      const orderId = this.orderId();
      if (orderId) {
        this.facade.loadOrderById(orderId);
      }
    });

    // Sync API payment_status → URL ?status= when not already present.
    // Effect is always registered (survives SSR → hydration), but
    // router.navigate is guarded to only run in the browser.
    effect(() => {
      const apiStatus = this.facade.invoicePaymentStatus();
      if (!apiStatus) return;

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status: apiStatus.toLowerCase() },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    // ponytail: two effects here needed the session layer — one bounced the
    // user home on logout, the other refreshed the current plan on the
    // payment-success edge so the header's `hasActivePlan` flipped at once.

    // Fire GA4/Netcore `purchase` once the order is confirmed paid (success
    // edge + order data loaded). trackPurchase dedupes by transaction_id, so a
    // refresh of the success URL can't double-count revenue.
    let purchaseSent: string | null = null;
    effect(() => {
      const status = this.paymentStatus();
      const orderId = this.orderId();
      const order = this.orderData();
      if (status !== 'success' || !orderId || !order) return;
      const key = `${orderId}:purchase`;
      if (purchaseSent === key) return;
      purchaseSent = key;
      this.analytics.trackPurchase({
        transaction_id: String(orderId),
        value: this.facade.invoiceGrandTotal(),
        currency: this.currencyCode(),
        base_price: this.facade.invoiceSubTotal(),
        selling_price: this.facade.invoiceGrandTotal(),
        product_discount: this.facade.invoiceTotalDiscount(),
        paid_amount: this.facade.invoiceTransactionDetails()?.paid_amount ?? 0,
        items: this.cartItems().map((it) => {
          const i = it as unknown as { id?: number; item_type?: string; paid_amount?: number };
          return {
            course_id: String(i.id ?? ''),
            course_type: i.item_type ?? '',
            price: i.paid_amount ?? 0,
          };
        }),
      });
    });
  }

  readonly hasSubscriptionItem = computed(() =>
    this.cartItems().some((item) => item.item_type === 'subscription'),
  );

  proceedToPayment() {
    if (!this.termsAccepted()) {
      this.notification.error('', 'Please accept the terms and conditions to proceed.');
      return;
    }

    if (!this.hasSubscriptionItem()) {
      this.facade.proceedToPayment();
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
        { label: 'Close', variant: 'ghost', action: 'close' },
        { label: 'Proceed to Payment', variant: 'default', action: 'confirm' },
      ],
    };

    const ref = this.dialog.open<UtilsDialog, { action?: string; result: boolean }>(UtilsDialog, {
      data: dialogData,
      width: 'auto',
      maxWidth: '32rem',
      disableClose: true,
    });

    ref.afterClosed$.subscribe((result) => {
      if (result?.action === 'confirm' && result.result) {
        this.facade.proceedToPayment();
      }
    });
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

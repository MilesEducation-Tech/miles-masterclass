import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { NgIconComponent } from '@ng-icons/core';
import { PaymentFacade } from './services/payment-facade';
import { CartSteps } from '@core/models/payment.model';
import { CART_STEP_DATA, PATH_TYPE_TO_STEP_ID } from '@features/payment/constants/payment';

/** Walk to the deepest activated route — `pathType` lives on the leaf. */
function deepestChild(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return snapshot.firstChild ? deepestChild(snapshot.firstChild) : snapshot;
}

@Component({
  selector: 'app-payment',
  imports: [RouterOutlet, NgIconComponent],
  templateUrl: './payment.html',
  styleUrl: './payment.css',
})
export class Payment {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly facade = inject(PaymentFacade);

  // No constructor-time fetch — the `cartResolver` on this route guarantees
  // the cart bucket is loaded before any child activates. Keeps the shell
  // pure and prevents a duplicate request after the resolver settled it.

  /** Number of items currently in the cart (0 when no cart loaded yet). */
  protected readonly cartCount = computed(() => this.facade.cartData()?.cartitem_data.length ?? 0);
  protected readonly loading = computed(() => this.facade.loading());
  protected readonly error = computed(() => this.facade.error());

  private readonly pathType = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => (deepestChild(this.route.snapshot).data['pathType'] as string) ?? ''),
    ),
    { initialValue: 'cart' },
  );

  // Fire `cart_view` whenever the journey step changes (cart → billing → review).
  private readonly trackPageView = effect(() => {
    const step = this.pathType();
    if (step === 'cart' || step === 'billing' || step === 'review') {
      this.facade.trackCartView(step);
    }
  });

  protected readonly cartSteps = computed<CartSteps[]>(() => {
    const activeStepId = PATH_TYPE_TO_STEP_ID[this.pathType()] ?? 1;
    return CART_STEP_DATA.map((step) => ({
      ...step,
      active: step.id <= activeStepId,
    }));
  });

  /** Re-fetch the cart after a failed load (Retry button on the error state). */
  retryLoad(): void {
    this.facade.loadMyBucket({ force: true });
  }
}

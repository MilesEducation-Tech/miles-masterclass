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
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { CartStore } from '@core/services/cart/cart-store';
import {
  CART_STEP_DATA,
  CartSteps,
  PATH_TYPE_TO_STEP_ID,
} from '@features/payment/constants/payment';

/** Walk to the deepest activated route — `pathType` lives on the leaf. */
function deepestChild(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return snapshot.firstChild ? deepestChild(snapshot.firstChild) : snapshot;
}

@Component({
  selector: 'app-payment',
  imports: [RouterOutlet, NgIconComponent],
  templateUrl: './payment.html',
})
export class Payment {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly facade = inject(PaymentFacade);

  constructor() {
    // The cart, billing and review steps all show the cart, so the shell reads it once for them.
    inject(CartStore).load();
  }

  private readonly pathType = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => (deepestChild(this.route.snapshot).data['pathType'] as string) ?? ''),
    ),
    { initialValue: 'cart' },
  );

  // Fire `cart_view` whenever the journey step changes (cart → review).
  private readonly trackPageView = effect(() => {
    const step = this.pathType();
    if (step === 'cart' || step === 'review') {
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
}

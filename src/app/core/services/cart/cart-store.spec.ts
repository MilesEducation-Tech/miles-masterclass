import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CartDetails, PAYMENT_ROUTES } from '../../models/payment.model';
import { CartStore } from './cart-store';

/**
 * `CartStore` had no spec at all before Phase 9, and its read is now an
 * `httpResource`. These pin the contract that `cartResolver` and `paymentGuard`
 * depend on — the one place in this phase where getting it wrong breaks checkout
 * rather than a carousel.
 *
 * The invariant that matters most: **`loading` must flip to `true` synchronously**
 * when a caller asks for the cart. `cartResolver` calls `loadMyBucket({force:true})`
 * and then immediately subscribes to `loading`, waiting for `false`. If the flip
 * were asynchronous the resolver would sample a settled state, pass straight
 * through, and activate `/payment/billing` with no cart loaded.
 */
describe('CartStore', () => {
  let backend: HttpTestingController;
  let cart: CartStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    cart = TestBed.inject(CartStore);
  });

  const bucketReqs = () => backend.match((r) => r.url.includes(PAYMENT_ROUTES.myBucket.path));

  /** Resources apply a flushed response on a microtask, so a tick alone is not enough. */
  const settle = async () => {
    await Promise.resolve();
    TestBed.tick();
    await Promise.resolve();
  };

  const flush = async (data: unknown) => {
    const reqs = bucketReqs();
    expect(reqs).toHaveLength(1);
    reqs[0].flush({ data });
    await settle();
  };

  it('is idle until something asks — no request, and loading is false', () => {
    expect(cart.loading()).toBe(false);
    expect(cart.cartFetched()).toBe(false);
    expect(cart.cartData()).toBeNull();
    backend.expectNone(() => true);
  });

  /** The invariant `cartResolver` rests on. */
  it('flips loading to true SYNCHRONOUSLY on the first ask', () => {
    cart.loadMyBucket({ force: true });
    expect(cart.loading()).toBe(true);
    expect(cart.cartFetched()).toBe(false);

    TestBed.tick();
    const reqs = bucketReqs();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].request.method).toBe('GET');
    // appInterceptor owns the bearer; nothing is hand-attached.
    expect(reqs[0].request.headers.has('Authorization')).toBe(false);
    reqs[0].flush({ data: null });
  });

  it('exposes the cart once the request settles', async () => {
    cart.loadMyBucket();
    TestBed.tick();
    await flush({ cart_id: 7 });

    expect(cart.cartData()).toEqual({ cart_id: 7 });
    expect(cart.cartFetched()).toBe(true);
    expect(cart.loading()).toBe(false);
    expect(cart.error()).toBeNull();
  });

  it('is idempotent — a second unforced ask issues no request', async () => {
    cart.loadMyBucket();
    TestBed.tick();
    await flush({ cart_id: 7 });

    cart.loadMyBucket();
    TestBed.tick();
    expect(bucketReqs()).toHaveLength(0);
  });

  it('re-fetches on { force: true } after a settled load', async () => {
    cart.loadMyBucket();
    TestBed.tick();
    await flush({ cart_id: 7 });

    cart.loadMyBucket({ force: true });
    // Synchronous again, this time via reload().
    expect(cart.loading()).toBe(true);
    TestBed.tick();
    await flush({ cart_id: 9 });

    expect(cart.cartData()).toEqual({ cart_id: 9 });
  });

  /**
   * A failed cart must UNBLOCK navigation, not hang it: the resolver waits for
   * `loading` to go false, and `paymentGuard` then redirects on `error()`. It must
   * also not throw — `value()` throws on an errored resource even with a
   * `defaultValue`, which is why `cartData` guards with `hasValue()`.
   */
  it('settles on error: loading clears, error is set, and nothing throws', async () => {
    cart.loadMyBucket();
    TestBed.tick();
    bucketReqs()[0].flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(cart.loading()).toBe(false);
    expect(cart.cartFetched()).toBe(true);
    expect(cart.error()).toBe('Failed to load my bucket');
    expect(cart.cartData()).toBeNull();
  });

  /**
   * `PaymentFacade` pushes the cart it gets back from a coupon or checkout response
   * straight in, with no refetch. That is why `cartData` is a `linkedSignal` over
   * the resource rather than a plain `computed`.
   */
  it('accepts an external write through setCartData', async () => {
    cart.loadMyBucket();
    TestBed.tick();
    await flush({ cart_id: 7 });

    cart.setCartData({ cart_id: 42 } as CartDetails);
    expect(cart.cartData()).toEqual({ cart_id: 42 });
  });

  it('re-seeds cartData from the server on a forced reload, discarding a local write', async () => {
    cart.loadMyBucket();
    TestBed.tick();
    await flush({ cart_id: 7 });

    cart.setCartData({ cart_id: 42 } as CartDetails);
    cart.loadMyBucket({ force: true });
    TestBed.tick();
    await flush({ cart_id: 8 });

    expect(cart.cartData()).toEqual({ cart_id: 8 });
  });
});

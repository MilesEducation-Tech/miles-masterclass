import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthSession } from '@core/services/auth-session/auth-session';
import { CartStore } from '@core/services/cart/cart-store';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';

import { FooterOverlay } from './footer-overlay';
import { FOOTER_OVERLAY_ROUTES, isAllowedRoute } from './footer-overlay.config';

describe('FooterOverlay', () => {
  let component: FooterOverlay;
  let fixture: ComponentFixture<FooterOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterOverlay],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(FooterOverlay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('FooterOverlay session gating', () => {
  const isAuthenticated = signal(false);
  const loadMyBucket = vi.fn();
  const getResource = vi.fn(() => ({ items: signal([]) }));

  async function create(): Promise<ComponentFixture<FooterOverlay>> {
    await TestBed.configureTestingModule({
      imports: [FooterOverlay],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { isAuthenticated } },
        { provide: CartStore, useValue: { loadMyBucket, cartData: signal(null) } },
        { provide: FeatureFacade, useValue: { getResource } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(FooterOverlay);
    await fixture.whenStable();
    return fixture;
  }

  /** Reaches the protected handler the template binds to. */
  const subscribe = (fixture: ComponentFixture<FooterOverlay>) =>
    (fixture.componentInstance as unknown as { onSubscribe(): void }).onSubscribe();

  beforeEach(() => {
    isAuthenticated.set(false);
    loadMyBucket.mockClear();
    getResource.mockClear();
  });

  it('signed out: loads no cart, requests no in-progress course, sends Subscribe to login', async () => {
    const fixture = await create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    subscribe(fixture);

    expect(loadMyBucket).not.toHaveBeenCalled();
    expect(getResource).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], expect.anything());
  });

  it('signed in: loads the cart, requests lastViewed, sends Subscribe to the plan page', async () => {
    isAuthenticated.set(true);
    const fixture = await create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    subscribe(fixture);

    expect(loadMyBucket).toHaveBeenCalledTimes(1);
    expect(getResource).toHaveBeenCalledWith('lastViewed', 'masterclass', { requiresAuth: true });
    expect(navigate.mock.calls[0][0]).toEqual(expect.arrayContaining(['payment', 'plan']));
  });

  it('signing in after render starts the cart load and the in-progress read', async () => {
    const fixture = await create();
    expect(loadMyBucket).not.toHaveBeenCalled();

    isAuthenticated.set(true);
    await fixture.whenStable();

    expect(loadMyBucket).toHaveBeenCalledTimes(1);
    expect(getResource).toHaveBeenCalledTimes(1);
  });
});

describe('isAllowedRoute', () => {
  const allow = FOOTER_OVERLAY_ROUTES;

  it('matches each allowlisted route after locale prefix', () => {
    expect(isAllowedRoute('/in/accounting/home', allow)).toBe(true);
    expect(isAllowedRoute('/us/accounting/masterclass', allow)).toBe(true);
    expect(isAllowedRoute('/in/accounting/podcast', allow)).toBe(true);
    expect(isAllowedRoute('/in/accounting/micro-learning', allow)).toBe(true);
    expect(isAllowedRoute('/in/accounting/library/course-library', allow)).toBe(true);
    expect(isAllowedRoute('/in/accounting/library/instructor-library', allow)).toBe(true);
    expect(isAllowedRoute('/in/accounting/library/badge-library', allow)).toBe(true);
  });

  it('matches descendants of an allowlisted route', () => {
    expect(isAllowedRoute('/in/accounting/library/course-library/filter/foo', allow)).toBe(true);
    // Course detail is a descendant of `masterclass`, so the overlay DOES show
    // there. This used to be asserted as `false` in the test below, which
    // contradicted the descendant rule this same test relies on. Prefix
    // matching is the intended design: `CONTINUE_CARD_ROUTES` exists precisely
    // because the Continue Learning card — and only that card — has to be
    // narrowed to exact matches so it stays off course detail and chapter
    // deeplinks. The overlay itself is not narrowed.
    expect(isAllowedRoute('/in/accounting/masterclass/42/some-course', allow)).toBe(true);
  });

  it('rejects routes outside the allowlist', () => {
    expect(isAllowedRoute('/in/accounting/payment/cart', allow)).toBe(false);
    expect(isAllowedRoute('/in/accounting/faq', allow)).toBe(false);
  });

  it('rejects URLs without locale prefix segments', () => {
    expect(isAllowedRoute('/', allow)).toBe(false);
    expect(isAllowedRoute('/auth/login', allow)).toBe(false);
    expect(isAllowedRoute('', allow)).toBe(false);
  });

  it('strips query string and fragment before matching', () => {
    expect(isAllowedRoute('/in/accounting/home?ref=x', allow)).toBe(true);
    expect(isAllowedRoute('/in/accounting/home#section', allow)).toBe(true);
  });
});

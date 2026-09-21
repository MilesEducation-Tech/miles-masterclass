import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

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
  });

  it('rejects routes outside the allowlist', () => {
    expect(isAllowedRoute('/in/accounting/masterclass/42/some-course', allow)).toBe(false);
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

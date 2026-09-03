import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth-interceptor';
import { Auth } from '../../services/auth/auth';
import { NotificationService } from '../../services/notification/notification';
import { of, BehaviorSubject } from 'rxjs';
import { SSO_AUTH_ROUTES } from '../../models/auth.model';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { signal } from '@angular/core';
// ... imports

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  // Mock type can be inferred or defined loosely for tests
  let authServiceSpy: {
    refreshToken: any;
    clearAuth: any;
    isRefreshing: any; // Signal
    accessTokenSubject: BehaviorSubject<string | null>;
  };
  let accessTokenSubject: BehaviorSubject<string | null>;
  let notificationSpy: { error: any; success: any };

  beforeEach(() => {
    accessTokenSubject = new BehaviorSubject<string | null>('initial-token');

    // Create a mock object compatible with Auth service
    authServiceSpy = {
      refreshToken: vi.fn(),
      clearAuth: vi.fn(),
      isRefreshing: signal(false), // Mock signal
      accessTokenSubject: accessTokenSubject,
    };

    // Default refreshToken behavior
    authServiceSpy.refreshToken.mockReturnValue(of('new-token'));

    notificationSpy = { error: vi.fn(), success: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: authServiceSpy },
        { provide: NotificationService, useValue: notificationSpy },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should pass through requests when no 401 occurs', () => {
    httpClient.get('/api/data').subscribe((response) => {
      expect(response).toBeTruthy();
    });

    const req = httpMock.expectOne('/api/data');
    req.flush({ data: 'success' });
  });

  it('should attempt refresh on 401 and retry request', () => {
    httpClient.get('/api/sensitive').subscribe((response) => {
      expect(response).toEqual({ data: 'refreshed' });
    });

    // 1. Initial request fails with 401
    const initialReq = httpMock.expectOne('/api/sensitive');
    initialReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // 2. Interceptor calls refreshToken
    expect(authServiceSpy.refreshToken).toHaveBeenCalled();
    expect(authServiceSpy.isRefreshing()).toBe(false); // Should be reset after flow

    // 3. Retry request with new token
    // Note: in a real HttpTestingController, strict order is maintained.
    // The retry request happens AFTER refreshToken completes.
    // Since we mocked refreshToken with `of('new-token')`, it completes immediately.

    const retryReq = httpMock.expectOne('/api/sensitive');
    expect(retryReq.request.headers.get('Authorization')).toBe('bearer new-token');
    retryReq.flush({ data: 'refreshed' });
  });

  it('should logout if refresh fails', () => {
    authServiceSpy.refreshToken.mockReturnValue(of(null)); // Simulate failure

    httpClient.get('/api/sensitive').subscribe({
      next: () => expect.fail('Should have errored'),
      error: (error) => {
        expect(error.message).toContain('Refresh token failed');
      },
    });

    const initialReq = httpMock.expectOne('/api/sensitive');
    initialReq.flush('Unauthorized', {
      status: 401,
      statusText: 'Unauthorized',
    });

    // No retry expected
  });

  // A 401 about the account (not the token) has nothing to refresh — the old
  // code cleared the session and threw 'Refresh token failed', swallowing the
  // server's message. The OTP flow's blocked-account rejection is the case.
  it('should notify and NOT refresh on an account_blocked 401', () => {
    const message = 'Your account has been blocked. Please contact your administrator.';

    httpClient.post('/api/v2/verify-otp/', {}).subscribe({
      next: () => expect.fail('Should have errored'),
      error: (error) => {
        expect(error.status).toBe(401);
        expect(error.error.error_code).toBe('account_blocked');
      },
    });

    httpMock
      .expectOne('/api/v2/verify-otp/')
      .flush(
        { field: 'detail', message, error_code: 'account_blocked' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(authServiceSpy.refreshToken).not.toHaveBeenCalled();
    expect(notificationSpy.error).toHaveBeenCalledWith('Account Blocked', message);
  });

  it('should still refresh on a token 401 (authentication_failed)', () => {
    httpClient.get('/api/sensitive').subscribe((res) => expect(res).toEqual({ data: 'refreshed' }));

    httpMock
      .expectOne('/api/sensitive')
      .flush(
        { field: 'detail', message: 'invalid_jwt_header', error_code: 'authentication_failed' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(authServiceSpy.refreshToken).toHaveBeenCalled();
    expect(notificationSpy.error).not.toHaveBeenCalled();
    httpMock.expectOne('/api/sensitive').flush({ data: 'refreshed' });
  });

  it('should NOT refresh if 401 comes from refresh endpoint', () => {
    // The real SSO refresh route. Previously this built a URL from
    // `environment.AUTH.refreshToken` — a *storage key* name, not a path — so it
    // never actually matched the interceptor's guard and proved nothing about
    // it. A dead refresh token must not trigger a refresh, or a 401 here loops
    // forever.
    const url = `/api/${SSO_AUTH_ROUTES.refreshToken.path}`;

    httpClient.post(url, {}).subscribe({
      next: () => expect.fail('Should have errored'),
      error: (error) => {
        expect(error.status).toBe(401);
      },
    });

    const req = httpMock.expectOne(url);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.refreshToken).not.toHaveBeenCalled();
  });
});

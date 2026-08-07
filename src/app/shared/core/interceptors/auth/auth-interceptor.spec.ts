import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth-interceptor';
import { Auth } from '../../services/auth/auth';
import { of, BehaviorSubject } from 'rxjs';
import { environment } from '../../../../../environments/environment';
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

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: authServiceSpy },
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

  it('should NOT refresh if 401 comes from refresh endpoint', () => {
    const refreshUrl = environment.AUTH.refreshToken || 'refresh_token';
    const url = `/api/${refreshUrl}`; // Construct a URL that matches logic

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

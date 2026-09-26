import { TestBed } from '@angular/core/testing';
import { ApplicationRef, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { ServerClock } from './server-clock';
import { WebinarFacade } from './webinar-facade';
import { WebinarRegistration } from './webinar-registration';
import { WEBINAR_ENDPOINTS } from '../models/webinar.model';

/**
 * The sign-in gate on `register()`.
 *
 * The rest of the facade is resource wiring that only says anything useful
 * against a live API; this branch is a real decision with a security-adjacent
 * consequence — posting `register-via-zoom` without a token is a 401 the
 * learner cannot act on — so it is the part worth pinning.
 */
describe('WebinarFacade.register — sign-in gate', () => {
  const isAuthenticated = signal(false);
  let registerSpy: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let afterClosed: Subject<{ action?: string; result: boolean } | undefined>;
  let facade: WebinarFacade;

  beforeEach(() => {
    isAuthenticated.set(false);
    registerSpy = vi.fn().mockResolvedValue({ result: 'registered' });
    afterClosed = new Subject();
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: afterClosed.asObservable() });
    navigate = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ServerClock,
        WebinarFacade,
        { provide: AuthSession, useValue: { isAuthenticated } },
        {
          provide: WebinarRegistration,
          useValue: {
            register: registerSpy,
            inFlight: signal(new Set()),
            isRegistering: () => false,
          },
        },
        { provide: NgpDialogManager, useValue: { open: dialogOpen } },
        { provide: Router, useValue: { navigate, url: '/us/cpa/webinar/w1' } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(new Map()),
            snapshot: { queryParamMap: new Map([['get', null]]) },
          },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        {
          provide: NotificationService,
          useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
        },
      ],
    });
    facade = TestBed.inject(WebinarFacade);
  });

  it('does NOT call the registration API when signed out', async () => {
    await facade.register('w1');

    expect(registerSpy).not.toHaveBeenCalled();
    expect(dialogOpen).toHaveBeenCalledTimes(1);
  });

  it('sends the learner back to the webinar they came from after signing in', async () => {
    await facade.register('w1');
    afterClosed.next({ action: 'confirm', result: true });

    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { redirect: '/us/cpa/webinar/w1' },
    });
  });

  it('does not navigate when the learner dismisses the prompt', async () => {
    await facade.register('w1');
    afterClosed.next({ action: 'cancel', result: false });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('registers directly when signed in, with no dialog', async () => {
    isAuthenticated.set(true);

    await facade.register('w1');

    expect(registerSpy).toHaveBeenCalledWith('w1');
    expect(dialogOpen).not.toHaveBeenCalled();
  });
});

/**
 * The two reads that moved from `resource()` + `firstValueFrom` to `httpResource`.
 * These pin what the old loaders did by hand: the clock sync, the error banner,
 * and a 404 detail counting as "missing" rather than as a failure.
 */
describe('WebinarFacade reads', () => {
  const FEED_URL = apiUrl(WEBINAR_ENDPOINTS.mainPage);
  const DETAIL_URL = apiUrl(WEBINAR_ENDPOINTS.detailsPage);
  let facade: WebinarFacade;
  let http: HttpTestingController;
  let logError: ReturnType<typeof vi.fn>;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    logError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        ServerClock,
        WebinarFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { isAuthenticated: signal(false) } },
        {
          provide: WebinarRegistration,
          useValue: { register: vi.fn(), inFlight: signal(new Set()), isRegistering: () => false },
        },
        { provide: NgpDialogManager, useValue: { open: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn(), url: '/' } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(new Map()),
            snapshot: { queryParamMap: new Map([['get', null]]) },
          },
        },
        { provide: Logger, useValue: { error: logError, warn: vi.fn(), info: vi.fn() } },
        {
          provide: NotificationService,
          useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
        },
      ],
    });
    facade = TestBed.inject(WebinarFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the pre_login feed and syncs the server clock from it', async () => {
    void facade.heroWebinar();
    TestBed.tick();
    const req = http.expectOne((r) => r.url === FEED_URL);
    expect(req.request.params.get('login_type')).toBe('pre_login');
    const serverTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    req.flush({
      data: {
        login_type: 'pre_login',
        server_time: serverTime,
        highlight_webinars: [],
        upcoming_webinars: [{ id: 'w1' }],
        completed_webinar: [],
        absent_webinar: [],
        missed_webinar: [],
      },
    });
    await settle();

    expect(facade.heroWebinar()?.id).toBe('w1');
    expect(facade.loadError()).toBeNull();
    // An hour ahead, give or take the test's own runtime.
    expect(TestBed.inject(ServerClock).now() - Date.now()).toBeGreaterThan(59 * 60 * 1000);
  });

  it('surfaces and logs a feed failure', async () => {
    void facade.heroWebinar();
    TestBed.tick();
    http.expectOne((r) => r.url === FEED_URL).flush(null, { status: 500, statusText: 'Boom' });
    await settle();

    expect(facade.loadError()?.status).toBe(500);
    expect(facade.heroWebinar()).toBeNull();
    expect(logError).toHaveBeenCalledWith(
      '[WebinarFacade] feed load failed',
      expect.anything(),
      expect.anything(),
    );
  });

  it('treats a 404 detail as missing, not as a failure', async () => {
    void facade.heroWebinar();
    facade.showDetail('w9');
    TestBed.tick();
    http.expectOne((r) => r.url === FEED_URL).flush({ data: null });
    const req = http.expectOne((r) => r.url === DETAIL_URL);
    expect(req.request.params.get('webinar_id')).toBe('w9');
    req.flush(null, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(facade.isDetailMissing()).toBe(true);
    expect(facade.detailWebinar()).toBeNull();
    expect(logError).not.toHaveBeenCalledWith(
      '[WebinarFacade] detail load failed',
      expect.anything(),
      expect.anything(),
    );
  });

  it('returns the detail row when the endpoint answers', async () => {
    facade.showDetail('w2');
    void facade.detailWebinar();
    TestBed.tick();
    http.match((r) => r.url === FEED_URL).forEach((r) => r.flush({ data: null }));
    http.expectOne((r) => r.url === DETAIL_URL).flush({ data: { webinar: { id: 'w2' } } });
    await settle();

    expect(facade.detailWebinar()?.id).toBe('w2');
    expect(facade.isDetailMissing()).toBe(false);
  });
});

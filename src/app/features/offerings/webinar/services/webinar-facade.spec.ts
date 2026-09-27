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
import { WebinarFacade } from './webinar-facade';
import { WebinarRegistration } from './webinar-registration';
import { eligibleOf, WEBINAR_ENDPOINTS, WebinarCard, WebinarDetail } from '../models/webinar.model';

/** The contract's own §8 card example — every key, so it passes the parse. */
function contractCard(id: string, overrides: Record<string, unknown> = {}): WebinarCard {
  return {
    id,
    slug: 'caira-level-1-orientation',
    name: 'CAIRA Level 1',
    type: 'webinar',
    short_description: '...',
    start_date_time: '2026-09-20T13:00:00+00:00',
    end_date_time: '2026-09-20T14:00:00+00:00',
    duration_minutes: 60,
    webinar_zoom_id: '84123456789',
    is_test_webinar: false,
    webinar_why_attend_points: [],
    webinar_what_will_you_learn_points: [],
    subject: 'CAIRA',
    subject_details: { id: 'b2c4e1a8-7f39-4c52-9d61-08ab3e7f4d12', subject: 'CAIRA' },
    level_details: {
      level_id: 'd57e0b93-1a46-4f88-ae20-6c91f2b7e034',
      level_number: 1,
      level_name: 'Level 1',
      level_actual_name: 'Foundations of AI for Accountants',
    },
    horizontal_thumbnail: 'https://example.test/h.png',
    vertical_thumbnail: 'https://example.test/v.png',
    square_image: 'https://example.test/s.png',
    fields_of_study: [{ id: 'f1', name: 'Information Technology', cpe_credit: 1.0 }],
    total_cpe_credits: 1.0,
    ...overrides,
  };
}

/** The details payload: the card plus its four detail-only keys. */
function contractDetail(id: string): WebinarDetail {
  return {
    ...contractCard(id),
    description: null,
    trailer_url: null,
    trailer_thumbnail_url: null,
    product: null,
  };
}

/** An empty feed that passes the parse, for tests that only care about the detail. */
const EMPTY_FEED_BODY = {
  message: 'ok',
  data: {
    login_type: 'pre_login',
    highlight_webinars: [],
    upcoming_webinars: [],
    completed_webinar: [],
    absent_webinar: [],
    missed_webinar: [],
  },
};

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

  it('requests the pre_login feed', async () => {
    void facade.heroWebinar();
    TestBed.tick();
    const req = http.expectOne((r) => r.url === FEED_URL);
    expect(req.request.params.get('login_type')).toBe('pre_login');
    req.flush({
      data: {
        login_type: 'pre_login',
        highlight_webinars: [],
        upcoming_webinars: [contractCard('w1')],
        completed_webinar: [],
        absent_webinar: [],
        missed_webinar: [],
      },
    });
    await settle();

    expect(facade.heroWebinar()?.id).toBe('w1');
    expect(facade.loadError()).toBeNull();
  });

  // The trust boundary. The old name `cpe_credits` is exactly the drift that
  // hid every CPE pill before — it must now fail loudly, in one place.
  it.each([
    ['the pre-rename cpe_credits key', { total_cpe_credits: undefined, cpe_credits: 1 }],
    ['credits sent as a string', { total_cpe_credits: '3' }],
    ['an unknown type', { type: 'masterclass' }],
  ])('puts a feed with %s into loadError()', async (_, overrides) => {
    void facade.heroWebinar();
    TestBed.tick();
    http
      .expectOne((r) => r.url === FEED_URL)
      .flush({
        ...EMPTY_FEED_BODY,
        data: { ...EMPTY_FEED_BODY.data, upcoming_webinars: [contractCard('w1', overrides)] },
      });
    await settle();

    expect(facade.loadError()).toBeTruthy();
    expect(facade.heroWebinar()).toBeNull();
  });

  it('rejects a completed row without eligible', async () => {
    void facade.heroWebinar();
    TestBed.tick();
    http
      .expectOne((r) => r.url === FEED_URL)
      .flush({
        ...EMPTY_FEED_BODY,
        data: { ...EMPTY_FEED_BODY.data, completed_webinar: [contractCard('done')] },
      });
    await settle();

    expect(facade.loadError()).toBeTruthy();
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
    http.expectOne((r) => r.url === FEED_URL).flush(EMPTY_FEED_BODY);
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

  // The contract's 400 `invalid_request` for a non-uuid `webinar_id` — what an
  // old integer-id link sends. To the learner that is "no such webinar".
  it('treats a 400 detail (non-uuid id) as missing, not as a failure', async () => {
    facade.showDetail('123');
    void facade.detailWebinar();
    TestBed.tick();
    http.match((r) => r.url === FEED_URL).forEach((r) => r.flush(EMPTY_FEED_BODY));
    http
      .expectOne((r) => r.url === DETAIL_URL)
      .flush(
        {
          status: 'error',
          code: 'invalid_request',
          message: 'Invalid request.',
          errors: [{ field: 'webinar_id', message: 'Input should be a valid UUID' }],
        },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(facade.isDetailMissing()).toBe(true);
    expect(logError).not.toHaveBeenCalledWith(
      '[WebinarFacade] detail load failed',
      expect.anything(),
      expect.anything(),
    );
  });

  // Registering changes the card's `registration` block; the detail page reads
  // the detail row first, so it must be refetched too, not only the feed.
  it('reloads the detail row as well as the feed', async () => {
    facade.showDetail('w2');
    void facade.detailWebinar();
    void facade.heroWebinar();
    TestBed.tick();
    http.match((r) => r.url === FEED_URL).forEach((r) => r.flush(EMPTY_FEED_BODY));
    http
      .expectOne((r) => r.url === DETAIL_URL)
      .flush({ data: { login_type: 'pre_login', webinar: contractDetail('w2') } });
    await settle();

    facade.reload();
    TestBed.tick();

    expect(http.match((r) => r.url === FEED_URL)).toHaveLength(1);
    expect(http.match((r) => r.url === DETAIL_URL)).toHaveLength(1);
  });

  it('reports which bucket the feed placed a webinar in', async () => {
    void facade.heroWebinar();
    TestBed.tick();
    http
      .expectOne((r) => r.url === FEED_URL)
      .flush({
        data: {
          login_type: 'post_login',
          highlight_webinars: [],
          upcoming_webinars: [contractCard('up')],
          completed_webinar: [contractCard('done', { eligible: true })],
          absent_webinar: [],
          missed_webinar: [contractCard('gone')],
        },
      });
    await settle();

    expect(facade.bucketOf('up')).toBe('upcoming');
    expect(facade.bucketOf('done')).toBe('completed');
    expect(facade.bucketOf('gone')).toBe('missed');
    expect(facade.bucketOf('nowhere')).toBeNull();
    expect(eligibleOf(facade.findById('done'))).toBe(true);
  });

  it('returns the detail row when the endpoint answers', async () => {
    facade.showDetail('w2');
    void facade.detailWebinar();
    TestBed.tick();
    http.match((r) => r.url === FEED_URL).forEach((r) => r.flush(EMPTY_FEED_BODY));
    http
      .expectOne((r) => r.url === DETAIL_URL)
      .flush({ data: { login_type: 'pre_login', webinar: contractDetail('w2') } });
    await settle();

    expect(facade.detailWebinar()?.id).toBe('w2');
    expect(facade.isDetailMissing()).toBe(false);
  });
});

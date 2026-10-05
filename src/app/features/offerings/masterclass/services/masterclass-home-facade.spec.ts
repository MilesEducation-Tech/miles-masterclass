import { ApplicationRef, PLATFORM_ID, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { MASTERCLASS_ENDPOINTS } from '@features/offerings/masterclass/constants/masterclass';
import { MasterclassHomeFacade } from '@features/offerings/masterclass/services/masterclass-home-facade';
import { Utils } from '@shared/services/utils';
import {
  mockHomePageBody,
  mockMasterclassCourse,
  mockMasterclassTrack,
} from '@testing/mocks/masterclass-home.mock';

const HOME_URL = apiUrl(MASTERCLASS_ENDPOINTS.homePage);

describe('MasterclassHomeFacade', () => {
  const isAuthenticated = signal(false);
  let facade: MasterclassHomeFacade;
  let http: HttpTestingController;
  let logError: ReturnType<typeof vi.fn>;
  let openVideoDialog: ReturnType<typeof vi.fn>;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  function setup(platform: 'browser' | 'server' = 'browser') {
    isAuthenticated.set(false);
    logError = vi.fn();
    openVideoDialog = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        MasterclassHomeFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: AuthSession, useValue: { isAuthenticated } },
        { provide: Logger, useValue: { error: logError, warn: vi.fn(), info: vi.fn() } },
        { provide: Utils, useValue: { openVideoDialog } },
      ],
    });
    facade = TestBed.inject(MasterclassHomeFacade);
    http = TestBed.inject(HttpTestingController);
  }

  /** Reads the resource so it starts, then hands back the one request it sent. */
  function expectHomeRequest() {
    void facade.tracks();
    TestBed.tick();
    return http.expectOne((r) => r.url === HOME_URL);
  }

  afterEach(() => http.verify());

  it('asks for the pre_login page when signed out', async () => {
    setup();
    const req = expectHomeRequest();

    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('login_type')).toBe('pre_login');
    // Strict route: any other query key is a 400.
    expect(req.request.params.keys()).toEqual(['login_type']);

    req.flush(mockHomePageBody([mockMasterclassTrack('t1', [mockMasterclassCourse('c1')])]));
    await settle();

    expect(facade.tracks().map((t) => t.id)).toEqual(['t1']);
    expect(facade.loadError()).toBeNull();
  });

  it('asks for the post_login page when signed in', () => {
    setup();
    isAuthenticated.set(true);

    expect(expectHomeRequest().request.params.get('login_type')).toBe('post_login');
  });

  it('keeps the API order and drops tracks with no courses', async () => {
    setup();
    expectHomeRequest().flush(
      mockHomePageBody([
        mockMasterclassTrack('second', [mockMasterclassCourse('a')], { priority: 2 }),
        mockMasterclassTrack('empty', [], { priority: 3 }),
        mockMasterclassTrack('first', [mockMasterclassCourse('b')], { priority: 1 }),
      ]),
    );
    await settle();

    expect(facade.tracks().map((t) => t.id)).toEqual(['second', 'first']);
  });

  it('refetches on sign-in and holds the rails while it does', async () => {
    setup();
    expectHomeRequest().flush(
      mockHomePageBody([mockMasterclassTrack('t1', [mockMasterclassCourse('c1')])]),
    );
    await settle();
    // Read once while resolved, as the template does on every render: the hold
    // can only keep a value it has seen.
    expect(facade.tracks().map((t) => t.id)).toEqual(['t1']);

    isAuthenticated.set(true);
    const req = expectHomeRequest();

    expect(req.request.params.get('login_type')).toBe('post_login');
    expect(facade.tracks().map((t) => t.id)).toEqual(['t1']);

    req.flush(
      mockHomePageBody([mockMasterclassTrack('t2', [mockMasterclassCourse('c2')])], 'post_login'),
    );
    await settle();

    expect(facade.tracks().map((t) => t.id)).toEqual(['t2']);
  });

  it('puts a body that breaks the contract into loadError() and the log', async () => {
    setup();
    expectHomeRequest().flush(
      mockHomePageBody([mockMasterclassTrack('t1', [mockMasterclassCourse('c1', { id: 7 })])]),
    );
    await settle();

    expect(facade.loadError()?.message).toMatch(/home-page/);
    expect(facade.tracks()).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      '[MasterclassHomeFacade] home-page load failed',
      expect.anything(),
    );
  });

  it('surfaces an HTTP failure, and reload() asks again', async () => {
    setup();
    expectHomeRequest().flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(facade.loadError()).toBeTruthy();

    facade.reload();
    TestBed.tick();
    http
      .expectOne((r) => r.url === HOME_URL)
      .flush(mockHomePageBody([mockMasterclassTrack('t1', [mockMasterclassCourse('c1')])]));
    await settle();

    expect(facade.loadError()).toBeNull();
    expect(facade.tracks()).toHaveLength(1);
  });

  it('opens the trailer in the shared video dialog', () => {
    setup();
    const course = mockMasterclassCourse('c1');

    facade.openTrailer(course);

    expect(openVideoDialog).toHaveBeenCalledWith(course.trailer_url, course.title);
  });

  describe('on the server', () => {
    it('fetches the anonymous page, for crawlers', () => {
      setup('server');

      expect(expectHomeRequest().request.params.get('login_type')).toBe('pre_login');
    });

    it('skips the signed-in page: the token lives in the browser', () => {
      setup('server');
      isAuthenticated.set(true);
      void facade.tracks();
      TestBed.tick();

      http.expectNone((r) => r.url === HOME_URL);
      expect(facade.tracks()).toEqual([]);
    });
  });
});

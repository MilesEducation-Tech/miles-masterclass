import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { IS_ADMIN_REQUEST, SKIP_AUTH_TOKEN } from '@core/models/http.model';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { UserOnboardingFacade } from './user-onboarding-facade';

const USERS_URL = apiUrl('partners/superadmin/users/');
const CODES_URL = apiUrl('partners/superadmin/partner-codes/');
const REFERENCE = [
  'professions/',
  'user/professional-course/',
  'user/state-boards/',
  'user/job-sectors/',
].map(apiUrl);

describe('UserOnboardingFacade reads', () => {
  let facade: UserOnboardingFacade;
  let http: HttpTestingController;
  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  /**
   * Every read fires as the facade is built, not on first use, so a test answers the
   * ones it is not about, or `whenStable()` waits on them forever.
   */
  const answerOthers = (...keep: string[]) =>
    http
      .match((r) => !keep.includes(r.url))
      .forEach((r) => r.flush({ data: [], partner_codes: [] }));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Route-scoped: provided by hand.
        UserOnboardingFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    facade = TestBed.inject(UserOnboardingFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the users page with the admin token, and filters only when set', async () => {
    void facade.users();
    void facade.pagination();
    TestBed.tick();
    answerOthers(USERS_URL);
    const req = http.expectOne((r) => r.url === USERS_URL);
    expect(req.request.context.get(IS_ADMIN_REQUEST)).toBe(true);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('page_size')).toBe('30');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('domain')).toBe(false);
    req.flush({ data: [{ id: 4 }], pagination_data: { total_count: 1, next_page: null } });
    await settle();

    expect(facade.users().map((u) => u.id)).toEqual([4]);
    expect(facade.pagination()?.total_count).toBe(1);
    expect(facade.findLoadedUser(4)?.id).toBe(4);
  });

  it('keeps pagination readable when the users load fails', async () => {
    void facade.pagination();
    void facade.error();
    TestBed.tick();
    answerOthers(USERS_URL);
    http
      .expectOne((r) => r.url === USERS_URL)
      .flush({ message: 'Nope' }, { status: 500, statusText: 'Boom' });
    await settle();

    expect(facade.pagination()).toBeUndefined();
    expect(facade.error()).toBeTruthy();
  });

  it('loads the reference lists publicly and shapes them as options', async () => {
    void facade.professionOptions();
    void facade.courseOptions();
    void facade.stateBoardOptions();
    void facade.sectorOptions();
    TestBed.tick();
    answerOthers(...REFERENCE);
    const [professions, courses, boards, sectors] = REFERENCE.map((url) => {
      const req = http.expectOne(url);
      expect(req.request.context.get(SKIP_AUTH_TOKEN)).toBe(true);
      return req;
    });
    professions.flush({ data: [{ id: 1, name: 'CPA' }] });
    courses.flush({ data: [{ id: 2, title: 'CMA' }] });
    boards.flush({ data: [{ id: 3, name: 'NY' }] });
    sectors.flush({ data: [{ id: 4, name: 'Audit', roles: [{ id: 40, name: 'Senior' }] }] });
    await settle();

    expect(facade.professionOptions()).toEqual([{ value: 1, label: 'CPA' }]);
    expect(facade.courseOptions()).toEqual([{ value: 2, label: 'CMA' }]);
    expect(facade.stateBoardOptions()).toEqual([{ value: 3, label: 'NY' }]);
    expect(facade.rolesFor(4)).toEqual([{ value: 40, label: 'Senior' }]);
  });

  it('defaults the partner code to the active Creator code, and survives a failed list', async () => {
    void facade.defaultPartnerCode();
    TestBed.tick();
    answerOthers(CODES_URL);
    http.expectOne(CODES_URL).flush({
      partner_codes: [
        { code: 'OLD', description: 'Creator', is_active: false },
        { code: 'CRT', description: 'Creator plan', is_active: true },
      ],
    });
    await settle();
    expect(facade.defaultPartnerCode()).toBe('CRT');
    expect(facade.partnerCodeOptions().map((o) => o.value)).toEqual(['CRT']);

    facade.reloadPartnerCodes();
    TestBed.tick();
    http.expectOne(CODES_URL).flush(null, { status: 500, statusText: 'Boom' });
    await settle();
    expect(facade.partnerCodes()).toEqual([]);
  });
});

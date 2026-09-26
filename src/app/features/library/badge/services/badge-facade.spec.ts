import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Analytics } from '@core/services/analytics/analytics';
import { Utils } from '@shared/services/utils';
import { BadgeFacade } from './badge-facade';

const CATEGORIES_URL = apiUrl('badge-categories/');
const BADGES_URL = apiUrl('course-badges/');

describe('BadgeFacade', () => {
  let facade: BadgeFacade;
  let http: HttpTestingController;
  // The badge list chains on the categories (first one auto-selected), so steps use
  // a macrotask: `whenStable()` never resolves while a request is pending.
  const step = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  };
  const read = () => {
    void facade.badgeCategories();
    void facade.badgeItems();
    void facade.badgePagination();
    TestBed.tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Analytics, useValue: { trackEvent: vi.fn() } },
        { provide: Utils, useValue: { claimBadge: vi.fn() } },
      ],
    });
    facade = TestBed.inject(BadgeFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('selects the first category, then lists its badges', async () => {
    read();
    http.expectOne(CATEGORIES_URL).flush({ data: ['masterclass', 'podcast'] });
    await step();
    read();

    expect(facade.badgeCategory()).toBe('masterclass');
    const req = http.expectOne((r) => r.url === BADGES_URL);
    expect(req.request.params.get('course_type')).toBe('masterclass');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ data: [{ id: 1 }], pagination_data: { next_page: null } });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(facade.badgeItems().map((b) => b.id)).toEqual([1]);
  });

  it('lists nothing, and throws nothing, when the categories fail', async () => {
    read();
    http.expectOne(CATEGORIES_URL).flush(null, { status: 500, statusText: 'Boom' });
    await step();
    read();

    expect(facade.badgeCategories()).toEqual([]);
    expect(facade.badgeCategory()).toBeNull();
    http.expectNone((r) => r.url === BADGES_URL);
  });

  it('keeps pagination readable when the badge list fails', async () => {
    read();
    http.expectOne(CATEGORIES_URL).flush({ data: ['masterclass'] });
    await step();
    read();
    http.expectOne((r) => r.url === BADGES_URL).flush(null, { status: 500, statusText: 'Boom' });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(facade.badgePagination()).toBeUndefined();
    expect(facade.badgeError()).toBeTruthy();
  });
});

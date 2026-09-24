import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthSession } from '@core/services/auth-session/auth-session';
import { FeatureFacade } from './feature-facade';

/**
 * Before Phase 9 this file's only test was `expect(service).toBeTruthy()` — a
 * 724-line facade with 21 importers and 29 `getResource()` call sites had no HTTP
 * coverage at all. These cover what the `httpResource` conversion actually changed:
 * the request the non-track path issues, page accumulation, the auth gate that was
 * dead code until this phase, and the local-mutation paths that had to stay writable.
 *
 * The track key is deliberately not covered here — it keeps its RxJS fan-out and is
 * unchanged by this phase.
 */
describe('FeatureFacade', () => {
  let facade: FeatureFacade;
  let backend: HttpTestingController;
  let accessToken: ReturnType<typeof signal<string>>;

  beforeEach(() => {
    accessToken = signal('');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthSession,
          useValue: {
            accessToken,
            // The real service derives it the same way — a BOOLEAN, so a token
            // rotation is invisible to anything gating on it.
            isAuthenticated: computed(() => accessToken().length > 0),
          },
        },
      ],
    });

    backend = TestBed.inject(HttpTestingController);
    facade = TestBed.inject(FeatureFacade);
  });

  /**
   * Resources apply a flushed response on a MICROTASK, so `TestBed.tick()` alone
   * sees the `defaultValue` and never the payload.
   *
   * This is the await-then-tick form rather than the `ApplicationRef.whenStable()`
   * one used in `job-sectors.spec.ts`, and deliberately: `whenStable()` never
   * resolves while any request is still pending, and these tests routinely leave
   * sibling resources in flight. Await-then-tick works in both situations, so prefer
   * it as the general-purpose settle; reach for `whenStable()` only when every
   * pending request has already been flushed.
   */
  const settle = async () => {
    await Promise.resolve();
    TestBed.tick();
    await Promise.resolve();
  };

  const dashboardReqs = () => backend.match((r) => r.url.includes('v2/dashboard/'));

  const row = (id: number, extra: Record<string, unknown> = {}) => ({
    id,
    title: `Course ${id}`,
    ...extra,
  });

  it('issues one request for a public listing, with the route params and course type', async () => {
    const resource = facade.getResource('popular', 'masterclass');
    void resource.items();
    TestBed.tick();

    const reqs = dashboardReqs();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].request.method).toBe('GET');
    expect(reqs[0].request.params.get('filter')).toBe('popular');
    expect(reqs[0].request.params.get('course_type')).toBe('masterclass');
    expect(reqs[0].request.params.get('page')).toBe('1');
    // appInterceptor owns the bearer; nothing is hand-attached here.
    expect(reqs[0].request.headers.has('Authorization')).toBe(false);

    reqs[0].flush({ data: [row(1)], pagination_data: undefined });
    await settle();
    expect(resource.items()).toHaveLength(1);
  });

  /**
   * The re-wire this phase performed. Before it, `isAuthenticated` was hardcoded
   * `false`, so every `requiresAuth` listing returned [] without ever issuing a
   * request — seven keys, silently dead.
   */
  it('sends NOTHING for a requiresAuth listing while signed out', () => {
    const resource = facade.getResource('bookmark', 'masterclass', { requiresAuth: true });
    void resource.items();
    TestBed.tick();

    backend.expectNone(() => true);
    expect(resource.items()).toEqual([]);
  });

  it('fetches a requiresAuth listing once signed in', async () => {
    const resource = facade.getResource('bookmark', 'masterclass', { requiresAuth: true });
    void resource.items();
    TestBed.tick();
    backend.expectNone(() => true);

    accessToken.set('token-1');
    TestBed.tick();

    const reqs = backend.match((r) => r.url.includes('v2/user/bookmarks/'));
    expect(reqs).toHaveLength(1);
    reqs[0].flush({ data: [row(7)] });
    await settle();

    expect(resource.items()).toHaveLength(1);
  });

  /**
   * Gating on the BOOLEAN rather than the token string is what keeps a rotation
   * from re-firing every listing in the app.
   */
  it('does NOT re-fetch when only the token rotates', async () => {
    const resource = facade.getResource('bookmark', 'masterclass', { requiresAuth: true });
    void resource.items();
    accessToken.set('token-1');
    TestBed.tick();
    backend.match((r) => r.url.includes('v2/user/bookmarks/'))[0].flush({ data: [row(7)] });
    await settle();

    accessToken.set('token-2-rotated');
    TestBed.tick();

    expect(backend.match(() => true)).toHaveLength(0);
  });

  it('accumulates pages rather than replacing them', async () => {
    const resource = facade.getResource('popular', 'masterclass');
    void resource.items();
    TestBed.tick();
    dashboardReqs()[0].flush({
      data: [row(1), row(2)],
      pagination_data: {
        current_page: 1,
        next_page: 2,
        prev_page: null,
        total_pages: 2,
        total_count: 4,
      },
    });
    await settle();
    expect(resource.items().map((i) => i.id)).toEqual([1, 2]);

    resource.loadNextPage();
    TestBed.tick();
    const page2 = dashboardReqs();
    expect(page2).toHaveLength(1);
    expect(page2[0].request.params.get('page')).toBe('2');
    page2[0].flush({
      data: [row(3), row(4)],
      pagination_data: {
        current_page: 2,
        next_page: null,
        prev_page: 1,
        total_pages: 2,
        total_count: 4,
      },
    });
    await settle();

    // Appended, not replaced — this is what makes "load more" work.
    expect(resource.items().map((i) => i.id)).toEqual([1, 2, 3, 4]);
  });

  it('resets the accumulator when filters change', async () => {
    const resource = facade.getResource('popular', 'masterclass');
    void resource.items();
    TestBed.tick();
    dashboardReqs()[0].flush({
      data: [row(1)],
      pagination_data: {
        current_page: 1,
        next_page: 2,
        prev_page: null,
        total_pages: 2,
        total_count: 2,
      },
    });
    await settle();

    // Read between pages, because `items` accumulates through its own previous
    // value and a signal is LAZY: a page that nobody observed was never folded in.
    // A rendered `@for (item of resource.items())` reads on every change detection,
    // and `loadNextPage()` is only ever reached from such a list, so this models
    // the real sequence rather than working around it.
    expect(resource.items()).toHaveLength(1);

    resource.loadNextPage();
    TestBed.tick();
    dashboardReqs()[0].flush({ data: [row(2)], pagination_data: undefined });
    await settle();
    expect(resource.items()).toHaveLength(2);

    resource.setFilters({ ...resource.filters(), instructor_ids: [9] });
    TestBed.tick();
    const filtered = dashboardReqs();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].request.params.get('page')).toBe('1');
    filtered[0].flush({ data: [row(5)], pagination_data: undefined });
    await settle();

    // Page 1 clears the accumulator, so the filtered result stands alone.
    expect(resource.items().map((i) => i.id)).toEqual([5]);
  });

  /**
   * A failure is settled-with-no-rows, matching the old `catchError`. Pagination
   * must be cleared: a stale `next_page` would make an infinite-scroll container
   * keep asking for a page that just failed.
   */
  it('treats a failed request as an empty page and clears pagination', async () => {
    const resource = facade.getResource('popular', 'masterclass');
    void resource.items();
    TestBed.tick();
    dashboardReqs()[0].flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(resource.items()).toEqual([]);
    expect(resource.paginationData()).toBeUndefined();
    expect(resource.isLoading()).toBe(false);
  });

  /**
   * `applyBookmarkChange` flips the flag across every loaded listing with no
   * round-trip, which is why `items` had to stay writable through the conversion.
   */
  it('flips a bookmark flag across a loaded listing without re-fetching', async () => {
    const resource = facade.getResource('popular', 'masterclass');
    void resource.items();
    TestBed.tick();
    dashboardReqs()[0].flush({ data: [row(1, { added_bookmark: false }), row(2)] });
    await settle();

    facade.applyBookmarkChange(1, true, 'masterclass');

    expect(resource.items().find((i) => i.id === 1)?.['added_bookmark']).toBe(true);
    expect(backend.match(() => true)).toHaveLength(0);
  });

  /** `prependItem`/`patchItems` edit the page accumulator, so they survive a flatten. */
  it('keeps a locally prepended row across a later page load', async () => {
    const resource = facade.getResource('popular', 'masterclass');
    void resource.items();
    TestBed.tick();
    dashboardReqs()[0].flush({
      data: [row(1)],
      pagination_data: {
        current_page: 1,
        next_page: 2,
        prev_page: null,
        total_pages: 2,
        total_count: 3,
      },
    });
    await settle();

    resource.prependItem(row(99));
    expect(resource.items().map((i) => i.id)).toEqual([99, 1]);

    resource.loadNextPage();
    TestBed.tick();
    dashboardReqs()[0].flush({ data: [row(2)], pagination_data: undefined });
    await settle();

    // Page 1 (including the local prepend) is still there under the new page.
    expect(resource.items().map((i) => i.id)).toEqual([99, 1, 2]);
  });

  it('wraps a single-object response so consumers keep reading items()[0]', async () => {
    const resource = facade.getResource('lastViewed', 'masterclass', { requiresAuth: true });
    void resource.items();
    accessToken.set('token-1');
    TestBed.tick();

    const reqs = backend.match((r) => r.url.includes('v2/user/last_viewed/'));
    expect(reqs).toHaveLength(1);
    // A single global endpoint: no page, no course_type.
    expect(reqs[0].request.params.get('page')).toBeNull();
    reqs[0].flush({ data: row(42) });
    await settle();

    expect(resource.items()).toHaveLength(1);
    expect(resource.items()[0].id).toBe(42);
  });

  /**
   * The one standing constraint of accumulating through `previous`: a non-first page
   * must never be re-requested for the same page number, or its rows would append
   * twice. `refresh()` is the path that could have done it, so it resets to page 1
   * first — this pins that, because a regression here shows up as duplicated cards
   * rather than an error.
   */
  it('refresh() goes back to page 1 rather than re-appending the current page', async () => {
    const resource = facade.getResource('popular', 'masterclass');
    void resource.items();
    TestBed.tick();
    dashboardReqs()[0].flush({
      data: [row(1)],
      pagination_data: {
        current_page: 1,
        next_page: 2,
        prev_page: null,
        total_pages: 2,
        total_count: 2,
      },
    });
    await settle();
    expect(resource.items()).toHaveLength(1);

    resource.loadNextPage();
    TestBed.tick();
    dashboardReqs()[0].flush({ data: [row(2)], pagination_data: undefined });
    await settle();
    expect(resource.items().map((i) => i.id)).toEqual([1, 2]);

    resource.refresh();
    TestBed.tick();
    const refreshed = dashboardReqs();
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0].request.params.get('page')).toBe('1');
    refreshed[0].flush({ data: [row(1)], pagination_data: undefined });
    await settle();

    // Replaced, not appended — no duplicate of row 1 and no leftover row 2.
    expect(resource.items().map((i) => i.id)).toEqual([1]);
  });

  it('shares one resource instance per key+type', () => {
    const a = facade.getResource('popular', 'masterclass');
    const b = facade.getResource('popular', 'masterclass');
    expect(b).toBe(a);
  });

  afterEach(() => {
    // Flush anything a cache-hit refresh kicked off so verify() stays honest.
    backend.match(() => true).forEach((r) => r.flush({ data: [] }));
    backend.verify();
  });
});

/**
 * This class has never fetched during SSR, and that had to survive the conversion:
 * `httpResource` fetches on the server BY DEFAULT (that is what feeds the transfer
 * cache), so preserving the old behaviour takes an explicit `isBrowser` gate in the
 * request function. Dropping that gate would put every listing into the server HTML
 * and move the `ssr smoke` gate — a deliberate decision for Phase 11, not a side
 * effect of this one.
 */
describe('FeatureFacade on the server', () => {
  let backend: HttpTestingController;
  let facade: FeatureFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: AuthSession,
          useValue: { accessToken: signal('token-1'), isAuthenticated: computed(() => true) },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    facade = TestBed.inject(FeatureFacade);
  });

  it('issues no request and reports an empty list, even signed in', () => {
    const resource = facade.getResource('popular', 'masterclass');
    expect(resource.items()).toEqual([]);
    TestBed.tick();

    backend.expectNone(() => true);
    backend.verify();
  });
});

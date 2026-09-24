import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CairaLadderItem } from '@core/models/caira-badge.model';
import { CairaLevelStack } from './caira-level-stack';

/**
 * Before Phase 9 this suite provided NO HttpClient at all, so the `resource()`
 * errored on every run and `hasValue()` swallowed it — the component only ever
 * rendered `FALLBACK_LEVELS` and the API path was never exercised. Both paths are
 * covered now.
 *
 * `levels` is `protected`, so assertions go through the rendered DOM rather than
 * the member, which is the more honest test anyway.
 *
 * Two things this suite must NOT do, both learned the hard way:
 *  - **Do not `await whenStable()` before flushing.** With a real `HttpClient` the
 *    ladder request is pending, so the app never reaches stability and the await
 *    hangs until the test times out. The old suite could await freely only because
 *    it had no `HttpClient` at all and the resource failed instantly.
 *  - **jsdom has no `window.matchMedia`**, which the component's `afterNextRender`
 *    gsap setup calls. Stubbed below; without it every test logs an ERROR. That was
 *    already happening before this phase, just invisibly. The stub MUST be restored
 *    in `afterEach`: `vi.stubGlobal` writes `globalThis`, which outlives this file,
 *    and `core/services/viewport` is also backed by `matchMedia`. A stub that
 *    answers `matches: false` to every query makes `Viewport` resolve to `mobile`,
 *    which silently broke `section-nav.spec.ts` — an order-dependent failure that
 *    only surfaced once an unrelated change reshuffled the execution order.
 */
describe('CairaLevelStack', () => {
  let component: CairaLevelStack;
  let fixture: ComponentFixture<CairaLevelStack>;
  let backend: HttpTestingController;

  const row = (rank: number, name: string): CairaLadderItem => ({
    id: rank,
    badge: {
      id: rank,
      name,
      sub_text: name,
      badge_type: 'caira_level',
      level_name: `Level ${rank}`,
      level_rank: rank,
      icon_url: null,
      required_credits: 10,
      is_coming_soon: false,
    },
    status: 'locked',
    progress: { earned: 0, required: 10, percentage: 0 },
    awarded_at: null,
    image_url: null,
    accept_url: null,
  });

  beforeEach(async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
      }),
    );

    await TestBed.configureTestingModule({
      imports: [CairaLevelStack],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CairaLevelStack);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // Never leave the global stubbed: see the note above.
  afterEach(() => vi.unstubAllGlobals());

  const matchLadder = () => backend.match((r) => r.url.includes('v2/caira-badges/'));

  /**
   * Resources apply their response on a microtask, so a tick alone is not enough.
   * Only safe to call once every pending request has been flushed.
   */
  const settle = async () => {
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();
  };

  /** Each card's `<h3>` renders `level.title`. */
  const titles = (): string[] =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.card h3'),
    ).map((n) => n.textContent?.trim() ?? '');

  const renderedCount = () =>
    (fixture.nativeElement as HTMLElement).querySelectorAll('.card-wrapper').length;

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requests the ladder unconditionally, with no auth gate', () => {
    const reqs = matchLadder();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].request.method).toBe('GET');
    // No hand-attached Authorization — appInterceptor owns that.
    expect(reqs[0].request.headers.has('Authorization')).toBe(false);
    reqs[0].flush({ data: [] });
  });

  it('renders the levels the API returns, sorted by rank', async () => {
    matchLadder()[0].flush({ data: [row(2, 'Second'), row(1, 'First')] });
    await settle();

    expect(titles()).toEqual(['First', 'Second']);
  });

  /**
   * The point of the `hasValue()` guard: an errored resource throws on `value()`,
   * and this is a marketing section on the home page — it must degrade, not take
   * the page down.
   */
  it('falls back to the static levels on error instead of throwing', async () => {
    matchLadder()[0].flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await settle();

    // FALLBACK_LEVELS, not an empty stack and not a thrown error.
    expect(renderedCount()).toBeGreaterThan(0);
    expect(titles()).toContain('Foundations of AI in Accounting');
  });
});

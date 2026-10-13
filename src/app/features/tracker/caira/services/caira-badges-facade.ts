import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  linkedSignal,
  PLATFORM_ID,
  Service,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { withPreviousValue } from '@core/utils/with-previous-value';
import {
  BADGES_PAGE_URL,
  BadgeSectionPage,
  CairaBadgesPage,
  EMPTY_BADGES_PAGE,
  LevelBadge,
  MasterclassBadge,
  nextSectionPage,
  parseBadgesPage,
  WebinarBadge,
} from '../models/caira-badge-page.model';

/** One section's loaded pages, keyed by page number. */
type PageMap<T> = ReadonlyMap<number, readonly T[]>;

/**
 * Fold a freshly-arrived page into what is already held.
 *
 * Keyed by page number rather than appended, because all three sections share ONE request:
 * advancing the masterclass page refetches the webinar section too, and a plain append
 * would add a page the learner already has a second time. Page 1 is a fresh start — it is
 * what comes back after any reset, so it clears rather than merges.
 */
function mergeSection<T>(previous: PageMap<T> | undefined, block: BadgeSectionPage<T>): PageMap<T> {
  const merged = block.page === 1 ? new Map<number, readonly T[]>() : new Map(previous);
  merged.set(block.page, block.results);
  return merged;
}

const flattenPages = <T>(pages: PageMap<T>): T[] =>
  [...pages.keys()].sort((a, b) => a - b).flatMap((page) => [...(pages.get(page) ?? [])]);

/**
 * Everything the CAIRA tracker shows, from the one `badges/page/` read.
 *
 * Route-scoped, on the tracker's parent route, so the home page and both "View all" pages
 * share a single instance and a single response — navigating home → View all → home does
 * not refetch. Before this existed the feature fired five requests from five components,
 * each owning its own `httpResource`; one endpoint now serves all of them.
 *
 * ## Paging
 *
 * The API namespaces its paging parameters per section (`?webinar_badges.page=2`), so one
 * request carries every section's page at once. Only one section's page ever moves at a
 * time — the learner is on one listing page — but the others still come back, which is why
 * the accumulators are keyed by page number (`mergeSection`) instead of appending blindly.
 *
 * `level_badges` is not accumulated: the ladder is three rungs on one page, and the hero
 * steps through them with chevrons rather than scrolling.
 */
@Service({ autoProvided: false })
export class CairaBadgesFacade {
  private readonly auth = inject(AuthSession);
  private readonly logger = inject(Logger);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly webinarPage = signal(1);
  private readonly masterclassPage = signal(1);

  private readonly pageResource = httpResource<CairaBadgesPage>(
    () => {
      // Per-user and `IsAuthenticated`: there is nothing to server-render, and a request
      // without a token is a 401 rather than an empty page. Gated on the session's
      // BOOLEAN, never the token string — a token rotation would otherwise refire this.
      // `authGuard` already turns a signed-out visitor away; this is the second line.
      if (!this.isBrowser || !this.auth.isAuthenticated()) return undefined;

      return {
        url: apiUrl(BADGES_PAGE_URL),
        params: {
          'webinar_badges.page': this.webinarPage(),
          'masterclass_badges.page': this.masterclassPage(),
        },
      };
    },
    // The trust boundary: a body that drifted from the contract lands in `error()` here —
    // and so in `loadError()` — instead of half-rendered on screen.
    { defaultValue: EMPTY_BADGES_PAGE, parse: parseBadgesPage },
  );

  /** Stale-while-revalidate, so loading page 2 never blanks page 1. */
  private readonly page = withPreviousValue(this.pageResource);

  /** Guarded: `value()` throws on an errored resource. */
  private readonly data = computed(() =>
    this.page.hasValue() ? (this.page.value() ?? EMPTY_BADGES_PAGE) : EMPTY_BADGES_PAGE,
  );

  // ---- Status ------------------------------------------------------------

  readonly isLoading = computed(() => this.page.isLoading());
  readonly loadError = computed(() => this.page.error() ?? null);

  constructor() {
    effect(() => {
      const error = this.loadError();
      if (error) this.logger.error('[caira-tracker] badges/page failed', error);
    });

    // The session can disappear while the page is open: a refresh that fails calls
    // `AuthSession.clear()`, which empties the token. `authGuard` is a `CanMatch` guard, so
    // it does NOT re-run on a route that already matched — and the read's request function
    // then returns `undefined`, parking the resource at `idle`. Idle is neither loading nor
    // an error, so the hero and both rails hide themselves and the page goes silently
    // blank with no way out. Send them where the guard would have.
    effect(() => {
      if (!this.isBrowser || this.auth.isAuthenticated()) return;
      untracked(() => {
        this.logger.warn('[caira-tracker] session lost while on the tracker; redirecting');
        void this.router.navigate(['/auth/login'], {
          queryParams: { redirect: this.router.url },
        });
      });
    });
  }

  // ---- Summary and ladder ------------------------------------------------

  readonly cpeSummary = computed(() => this.data().cpe_summary);

  /** The three rungs. One page, so no accumulator. */
  readonly levels = computed<LevelBadge[]>(() => this.data().level_badges.results);

  /**
   * Which rung the hero opens on: the learner's current level, else the one they are
   * working toward. The ladder rows carry no per-rung progress of their own, so this is
   * the server's answer rather than something derived from the rows.
   */
  readonly focusLevelNumber = computed(() => {
    const summary = this.cpeSummary();
    return (
      summary.current_level?.number ??
      summary.next_level?.number ??
      this.levels()[0]?.level.number ??
      1
    );
  });

  // ---- Paged sections ----------------------------------------------------

  private readonly webinarPages = linkedSignal({
    source: this.page.snapshot,
    computation: (snap, previous): PageMap<WebinarBadge> => {
      if (snap.status !== 'resolved') return previous?.value ?? new Map();
      return mergeSection(previous?.value, (snap.value ?? EMPTY_BADGES_PAGE).webinar_badges);
    },
  });

  private readonly masterclassPages = linkedSignal({
    source: this.page.snapshot,
    computation: (snap, previous): PageMap<MasterclassBadge> => {
      if (snap.status !== 'resolved') return previous?.value ?? new Map();
      return mergeSection(previous?.value, (snap.value ?? EMPTY_BADGES_PAGE).masterclass_badges);
    },
  });

  readonly webinarBadges = computed(() => flattenPages(this.webinarPages()));
  readonly masterclassBadges = computed(() => flattenPages(this.masterclassPages()));

  /** Server-side totals, so "Showing N of M" counts what exists, not what has loaded. */
  readonly webinarCount = computed(() => this.data().webinar_badges.count);
  readonly masterclassCount = computed(() => this.data().masterclass_badges.count);

  // ---- Actions -----------------------------------------------------------

  /**
   * Advance one section. Called from the listing pages' scroll sentinels.
   *
   * No-ops while a request is in flight, and when the section has no further page — the
   * sentinel sits in the viewport for as long as the list is short, so it fires repeatedly.
   */
  loadMoreWebinars(): void {
    this.advance(this.webinarPage, this.data().webinar_badges);
  }

  loadMoreMasterclass(): void {
    this.advance(this.masterclassPage, this.data().masterclass_badges);
  }

  private advance(page: WritableSignal<number>, block: BadgeSectionPage<unknown>): void {
    if (this.isLoading()) return;
    const next = nextSectionPage(block);
    if (next !== null && next !== untracked(page)) page.set(next);
  }

  /** Retry after a failed load. Resets to page 1, so nothing accumulates across the gap. */
  reload(): void {
    const wasPaged = untracked(this.webinarPage) > 1 || untracked(this.masterclassPage) > 1;
    this.webinarPage.set(1);
    this.masterclassPage.set(1);
    // Changing a page already re-keys the request object, which refetches on its own. Only
    // a reset that changed nothing needs the explicit nudge — otherwise retry fires twice.
    if (!wasPaged) this.pageResource.reload();
  }
}

import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { computed, inject, PLATFORM_ID, Service, signal, untracked } from '@angular/core';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import {
  BADGES_PAGE_URL,
  CairaBadgesPage,
  EMPTY_BADGES_PAGE,
  parseBadgesPage,
} from '@features/tracker/caira/models/caira-badge-page.model';

/**
 * The CAIRA tracker's one read: `GET web-api/v1/badges/page/` returns the ladder, both badge
 * sections and the learner's CPE summary together. It replaced four `v2/` routes that now
 * answer 404.
 *
 * An API service, NOT a facade (AGENTS.md §3): it exposes the resource and the signals that
 * drive it, and holds no page rules. Accumulating pages, filtering, retry and the session
 * redirect all live in the three pages that own them. Root-scoped, so the tracker home and
 * both listings share one response — navigating between them costs no request.
 *
 * Three resource rules, same as `AccountApi` and `OnboardingApi`: gate on the session's
 * BOOLEAN and never the token string (a rotation would otherwise refire the read), never set
 * the bearer here (`appInterceptor` owns it), and `undefined` means idle.
 */
@Service()
export class CairaBadgesApi {
  private readonly auth = inject(AuthSession);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Which page of each paged section to ask for. The API namespaces its paging parameters per
   * section, so one request carries both. The listing pages advance these; each resets its own
   * to 1 when it opens, because this service outlives the page that moved it.
   */
  readonly webinarPage = signal(1);
  readonly masterclassPage = signal(1);

  readonly page = httpResource<CairaBadgesPage>(
    () => {
      // Per-user and `IsAuthenticated`: nothing to server-render, and a request without a
      // token is a 401 rather than an empty page. `authGuard` already turns a signed-out
      // visitor away; this is the second line.
      if (!this.isBrowser || !this.auth.isAuthenticated()) return undefined;

      return {
        url: apiUrl(BADGES_PAGE_URL),
        params: {
          'webinar_badges.page': this.webinarPage(),
          'masterclass_badges.page': this.masterclassPage(),
        },
      };
    },
    // The trust boundary: a body that drifted from the contract lands in `error()` here
    // instead of half-rendered on screen.
    { defaultValue: EMPTY_BADGES_PAGE, parse: parseBadgesPage },
  );

  /** Guarded: `value()` throws on an errored resource. */
  readonly data = computed(() =>
    this.page.hasValue() ? (this.page.value() ?? EMPTY_BADGES_PAGE) : EMPTY_BADGES_PAGE,
  );

  /** Retry after a failure. Back to page 1, so nothing accumulates across the gap. */
  reload(): void {
    const wasPaged = untracked(this.webinarPage) > 1 || untracked(this.masterclassPage) > 1;
    this.webinarPage.set(1);
    this.masterclassPage.set(1);
    // Changing a page already re-keys the request, which refetches on its own. Only a reset
    // that changed nothing needs the explicit nudge — otherwise retry fires twice.
    if (!wasPaged) this.page.reload();
  }
}

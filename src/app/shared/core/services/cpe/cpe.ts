import { httpResource } from '@angular/common/http';
import { DestroyRef, Service, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, map, tap } from 'rxjs';
import { ApiClient } from '../api-client/api-client';
import { Auth } from '../auth/auth';
import { CairaActivity } from '../caira-activity/caira-activity';
import { CAIRA } from '../../http/caira.endpoints';
import { cairaError } from '../../http/caira-error';
import {
  AllBadgesResponse,
  BadgeItem,
  BadgeTotals,
  CairaLevelBadge,
  ClaimLevelBadgeResponse,
  LevelProgress,
  LevelsProgressResponse,
  currentLevelNumber,
  toBadgeItems,
  toBadgeTotals,
  toLevelBadges,
  toLevelProgress,
  toTotalCpeCredits,
} from '../../models/caira/cpe.model';

/**
 * CPE credits, levels and badges — #5, #23 and #19.
 *
 * App-wide `@Service()`. The level rail is the CAIRA header on every signed-in
 * page and the badge list is the tracker; both read the same two payloads, and
 * the LMS's own comment says re-fetching per navigation is what caused its
 * header to flicker. One instance, keyed on the session, fixes that for free.
 *
 * Parity scope: these three endpoints are what the shipped LMS calls. #22, #24,
 * #25, #26 and #27 are in the registry and unused — do not add them here
 * without a reason beyond "it exists".
 */
@Service()
export class Cpe {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly activity = inject(CairaActivity);
  private readonly destroyRef = inject(DestroyRef);

  private readonly levels = httpResource<LevelsProgressResponse | undefined>(
    () => (this.auth.isAuthenticated() ? this.api.absoluteUrl(CAIRA.levelsProgress) : undefined),
    { defaultValue: undefined },
  );

  private readonly badges = httpResource<AllBadgesResponse | undefined>(
    () => (this.auth.isAuthenticated() ? this.api.absoluteUrl(CAIRA.allBadgesV4) : undefined),
    { defaultValue: undefined },
  );

  readonly isLoadingLevels = this.levels.isLoading;
  readonly isLoadingBadges = this.badges.isLoading;

  readonly levelsError = computed(() => {
    const err = this.levels.error();
    return err ? cairaError(err) : null;
  });

  readonly badgesError = computed(() => {
    const err = this.badges.error();
    return err ? cairaError(err) : null;
  });

  /** `error()` before `value()` — `value()` throws on a failed resource. */
  readonly levelProgress = computed<LevelProgress[]>(() =>
    this.levels.error() ? [] : toLevelProgress(this.levels.value()),
  );

  readonly totalCpeCredits = computed(() =>
    this.levels.error() ? 0 : toTotalCpeCredits(this.levels.value()),
  );

  /** `null` when no level is ongoing and not all are complete. */
  readonly currentLevel = computed(() => currentLevelNumber(this.levelProgress()));

  readonly badgeItems = computed<BadgeItem[]>(() =>
    this.badges.error() ? [] : toBadgeItems(this.badges.value()),
  );

  readonly levelBadges = computed<CairaLevelBadge[]>(() =>
    this.badges.error() ? [] : toLevelBadges(this.badges.value()),
  );

  readonly totals = computed<BadgeTotals>(() =>
    this.badges.error()
      ? { cairaCredits: 0, nonCairaCredits: 0, grandTotal: 0 }
      : toBadgeTotals(this.badges.value()),
  );

  /**
   * #19 · claim a level badge and get its Credly accept URL back.
   *
   * Binds the **web** twin, which takes `credly_assertion_id`. #28 shares the
   * name but takes a full `credly_accept_url` and is a different endpoint.
   *
   * Reloads both resources on success rather than trusting the next read: the
   * claim changes badge state server-side, and #26/#27's sibling pair has a
   * documented 300 s cache-prefix mismatch, so a stale read is a real risk.
   * Also emits the `badges_claim` activity event, matching the LMS.
   */
  claimLevelBadge(params: {
    credlyAssertionId: string;
    badgeName: string;
    creditAmount: number;
    webinarName?: string;
  }): Observable<string | null> {
    return this.api
      .post<ClaimLevelBadgeResponse>(CAIRA.levelBadgeClicked, {
        credly_assertion_id: params.credlyAssertionId,
      })
      .pipe(
        map((response) => response?.data?.credly_accept_url?.trim() || null),
        tap(() => {
          this.badges.reload();
          this.levels.reload();
          this.activity.badgeClaimed({
            badgeName: params.badgeName,
            creditAmount: params.creditAmount,
            webinarName: params.webinarName,
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      );
  }

  reload(): void {
    this.levels.reload();
    this.badges.reload();
  }
}

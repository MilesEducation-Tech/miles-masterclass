import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  PLATFORM_ID,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronUp, lucideInfo } from '@ng-icons/lucide';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { BadgeV2Response, CairaLadderItem } from '@core/models/caira-badge.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { Dialog } from '@core/services/dialog/dialog';
import { Button } from '@shared/ui/button/button';
import { Progress } from '@shared/ui/progress/progress';
import { badgeHaloHex } from '@shared/utils/badge-level';
import { localeLink } from '../../../utils/tracker-links';
import { levelProgressHint, seedLevelRank } from '../../utils/level-progress';
import { levelSlides } from '../../utils/level-carousel';

const CAIRA_LOGO =
  'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/caira-logo-white.webp';

const EMPTY_LADDER: BadgeV2Response<CairaLadderItem[]> = { data: [] };

/**
 * The CAIRA ladder hero. One request, no facade: `v2/caira-badges/` returns
 * every level, so stepping the chevrons costs nothing. The list omits the
 * retrieve-only `content`, so the ⓘ modal fetches `v2/caira-badges/:id/` itself
 * rather than the hero doing it per level.
 *
 * The badges render as a vertical carousel: the selected level centred at full
 * size, its neighbours peeking above and below. Stepping `selectedRank`
 * re-derives the transforms and CSS animates between them, so the chevrons are
 * the only control — see `levelSlides`.
 */
@Component({
  selector: 'app-caira-level-hero',
  imports: [Button, NgIcon, NgOptimizedImage, Progress, RouterLink],
  providers: [provideIcons({ lucideChevronUp, lucideChevronDown, lucideInfo })],
  templateUrl: './caira-level-hero.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CairaLevelHero {
  private readonly api = inject(ApiClient);
  private readonly dialog = inject(Dialog);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly cairaLogo = CAIRA_LOGO;
  protected readonly cpeTrackerLink = localeLink('cpe-tracker');

  // ---- Ladder ------------------------------------------------------------

  private readonly ladderResource = resource({
    // `undefined` params disable the resource — the ladder is per-user and
    // the endpoint requires a token, so there is nothing to server-render.
    params: () => (this.isBrowser ? {} : undefined),
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<BadgeV2Response<CairaLadderItem[]>>('v2/caira-badges/')
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: EMPTY_LADDER },
      ),
  });

  protected readonly ladder = computed(() => this.ladderResource.value()?.data ?? []);
  protected readonly isLoading = computed(() => this.ladderResource.isLoading());

  /**
   * Which level the chevrons are parked on. Seeded from the ladder but freely
   * writable — a `linkedSignal` rather than a `signal` + reset `effect`.
   */
  protected readonly selectedRank = linkedSignal<CairaLadderItem[], number>({
    source: this.ladder,
    computation: (ladder, previous) => seedLevelRank(ladder, previous?.source, previous?.value),
  });

  protected readonly activeLevel = computed(
    () => this.ladder().find((l) => l.badge.level_rank === this.selectedRank()) ?? null,
  );

  protected readonly nextLevel = computed(
    () => this.ladder().find((l) => l.badge.level_rank === this.selectedRank() + 1) ?? null,
  );

  protected readonly canStepDown = computed(() =>
    this.ladder().some((l) => l.badge.level_rank < this.selectedRank()),
  );
  protected readonly canStepUp = computed(() => this.nextLevel() !== null);

  // ---- Display -----------------------------------------------------------

  protected readonly percentage = computed(() =>
    Math.min(100, Math.max(0, this.activeLevel()?.progress.percentage ?? 0)),
  );

  protected readonly earned = computed(() => this.activeLevel()?.progress.earned ?? 0);

  protected readonly haloHex = computed(() =>
    badgeHaloHex(this.activeLevel()?.badge.level_rank ?? 1),
  );

  protected readonly description = computed(() => this.activeLevel()?.badge.description ?? '');

  /** Selected level centred, neighbours peeking — CSS animates between states. */
  protected readonly slides = computed(() => levelSlides(this.ladder(), this.selectedRank()));

  /**
   * Nothing to show and nothing in flight: the whole hero is hidden rather than
   * rendering an empty shell. Errors count as "no data" — a failed ladder fetch
   * leaves the section out too.
   */
  protected readonly isHidden = computed(() => !this.isLoading() && !this.ladder().length);

  protected readonly progressHint = computed(() => {
    const level = this.activeLevel();
    return level ? levelProgressHint(level, this.nextLevel()) : '';
  });

  // ---- Actions -----------------------------------------------------------

  protected step(delta: number): void {
    const target = this.selectedRank() + delta;
    if (this.ladder().some((l) => l.badge.level_rank === target)) this.selectedRank.set(target);
  }

  /**
   * Lazy-loads the dialog so its markup never lands in this route's chunk —
   * same shape as `Utils.openCourseInfoDialog`. The ladder row goes in as `data`
   * to paint the modal's header; the modal retrieves its own tab content.
   */
  protected async openInfo(): Promise<void> {
    const level = this.activeLevel();
    if (!level) return;
    const { CairaBadgeInfoDialog } =
      await import('@features/tracker/caira/dialogs/caira-badge-info-dialog/caira-badge-info-dialog');
    this.dialog.open(CairaBadgeInfoDialog, {
      data: { level },
      ariaLabel: 'CAIRA badge details',
    });
  }
}

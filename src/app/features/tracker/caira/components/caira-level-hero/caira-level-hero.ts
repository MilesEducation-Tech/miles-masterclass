import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronUp } from '@ng-icons/lucide';
import { Button } from '@shared/ui/button/button';
import { Progress } from '@shared/ui/progress/progress';
import { badgeHaloHex } from '@shared/utils/badge-level';
import { LevelBadge } from '../../models/caira-badge-page.model';
import { CairaBadgesFacade } from '../../services/caira-badges-facade';
import { localeLink } from '../../../utils/tracker-links';
import { levelPercentage, levelProgressHint, seedLevelRank } from '../../utils/level-progress';
import { levelSlides } from '../../utils/level-carousel';

const CAIRA_LOGO =
  'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/caira-logo-white.webp';

/**
 * The CAIRA ladder hero. It injects the tracker's facade rather than fetching: the ladder
 * arrives as `level_badges` on the same `badges/page/` response the rows below read, so
 * stepping the chevrons costs nothing.
 *
 * The badges render as a vertical carousel: the selected rung centred at full size, its
 * neighbours peeking above and below. Stepping `selectedRank` re-derives the transforms and
 * CSS animates between them, so the chevrons are the only control — see `levelSlides`.
 *
 * The ⓘ modal that used to sit beside "CPE Tracker" is gone. Its three tabs came from
 * `v2/caira-badges/:id/`'s retrieve-only `badge.content`; that route answers 404 and
 * `badges/page/` ships no `description` or `content` on a level row, so the button could
 * only ever have opened an empty dialog. Restore both the day the field appears.
 */
@Component({
  selector: 'app-caira-level-hero',
  imports: [Button, NgIcon, NgOptimizedImage, Progress, RouterLink],
  providers: [provideIcons({ lucideChevronUp, lucideChevronDown })],
  templateUrl: './caira-level-hero.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CairaLevelHero {
  private readonly facade = inject(CairaBadgesFacade);

  protected readonly cairaLogo = CAIRA_LOGO;
  protected readonly cpeTrackerLink = localeLink('cpe-tracker');

  protected readonly levels = this.facade.levels;
  protected readonly isLoading = this.facade.isLoading;

  /** CAIRA-only credits, which is what a rung's threshold is measured in. */
  protected readonly earned = computed(() => this.facade.cpeSummary().caira_cpe_credits);

  /**
   * Which rung the chevrons are parked on. Seeded from the ladder but freely writable — a
   * `linkedSignal` rather than a `signal` + reset `effect`. The focus level is read
   * untracked: it is the seed, not a dependency, and letting it re-fire would yank the rung
   * out from under a learner who had stepped away from it.
   */
  protected readonly selectedRank = linkedSignal<LevelBadge[], number>({
    source: this.levels,
    computation: (levels, previous) =>
      seedLevelRank(
        levels,
        previous?.source,
        previous?.value,
        untracked(this.facade.focusLevelNumber),
      ),
  });

  protected readonly activeLevel = computed(
    () => this.levels().find((l) => l.level.number === this.selectedRank()) ?? null,
  );

  protected readonly nextLevel = computed(
    () => this.levels().find((l) => l.level.number === this.selectedRank() + 1) ?? null,
  );

  protected readonly canStepDown = computed(() =>
    this.levels().some((l) => l.level.number < this.selectedRank()),
  );
  protected readonly canStepUp = computed(() => this.nextLevel() !== null);

  // ---- Display -----------------------------------------------------------

  protected readonly percentage = computed(() => {
    const level = this.activeLevel();
    return level ? levelPercentage(level, this.earned()) : 0;
  });

  protected readonly haloHex = computed(() => badgeHaloHex(this.activeLevel()?.level.number ?? 1));

  /**
   * The amber line under the heading. `subtitle` is null on every rung in UAT, so the rung's
   * own subject ("AI Mindset, Skillset & Toolset") carries it — that field is always set, and
   * an empty line here left the heading looking truncated.
   */
  protected readonly subtitle = computed(() => {
    const level = this.activeLevel();
    return level ? (level.subtitle ?? level.level.level_actual_name) : '';
  });

  /** Selected rung centred, neighbours peeking — CSS animates between states. */
  protected readonly slides = computed(() => levelSlides(this.levels(), this.selectedRank()));

  /**
   * Nothing to show and nothing in flight: the whole hero is hidden rather than rendering an
   * empty shell. Errors count as "no data" — the page above owns the visible error state.
   */
  protected readonly isHidden = computed(() => !this.isLoading() && !this.levels().length);

  protected readonly progressHint = computed(() => {
    const level = this.activeLevel();
    return level ? levelProgressHint(level, this.nextLevel(), this.earned()) : '';
  });

  // ---- Actions -----------------------------------------------------------

  protected step(delta: number): void {
    const target = this.selectedRank() + delta;
    if (this.levels().some((l) => l.level.number === target)) this.selectedRank.set(target);
  }
}

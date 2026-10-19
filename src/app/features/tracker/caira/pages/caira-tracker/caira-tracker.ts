import { Component, computed, inject } from '@angular/core';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { BadgeRow, BadgeRowSection } from '@features/tracker/caira/components/badge-row/badge-row';
import { CairaLevelHero } from '@features/tracker/caira/components/caira-level-hero/caira-level-hero';
import { MasterclassBadge } from '@features/tracker/caira/models/caira-badge-page.model';
import { BadgeActions } from '@features/tracker/caira/services/badge-actions';
import { CairaBadgesApi } from '@features/tracker/caira/services/caira-badges-api';
import { redirectOnSessionLoss } from '@features/tracker/caira/utils/session-redirect';

interface RowConfig {
  heading: string;
  section: BadgeRowSection;
  viewAllLink: string;
}

/**
 * CAIRA Progress home — the ladder hero over one rail per badge section.
 *
 * The page reads `CairaBadgesApi` and hands each child exactly what it renders; the hero and
 * the rails take inputs and inject nothing. It also owns the CTA, because a card's action is
 * a page concern rather than a rail one.
 *
 * Two rows, not four. The page used to draw Podcast and Nano-Learning rows as well, fed by
 * `v2/course-badges/?course_type=`; `badges/page/` has no section for either, so they could
 * only ever render empty. Whether they are coming back is an open question with the
 * backend — add the entry here when a section appears.
 */
@Component({
  selector: 'app-caira-tracker',
  imports: [BadgeRow, CairaLevelHero, ErrorState],
  templateUrl: './caira-tracker.html',
  host: { class: 'block' },
})
export class CairaTracker {
  private readonly api = inject(CairaBadgesApi);
  private readonly actions = inject(BadgeActions);

  protected readonly rows: readonly RowConfig[] = [
    { heading: 'Webinar Badges', section: 'webinar_badges', viewAllLink: 'webinar-badges' },
    {
      heading: 'Masterclass Course Badges',
      section: 'masterclass_badges',
      viewAllLink: 'course-badges',
    },
  ];

  protected readonly isLoading = computed(() => this.api.page.isLoading());

  /**
   * The hero and the rails both hide themselves when they have nothing, so without this the
   * page was a blank shell with no way back — which is exactly what the dead v2 endpoints
   * left behind. One visible error, owned here, rather than one per section.
   */
  protected readonly hasError = computed(() => !!this.api.page.error());

  protected readonly levels = computed(() => this.api.data().level_badges.results);
  protected readonly webinarBadges = computed(() => this.api.data().webinar_badges.results);
  protected readonly masterclassBadges = computed(() => this.api.data().masterclass_badges.results);

  /**
   * The credits a rung's threshold is measured in — **total**, not `caira_cpe_credits`.
   *
   * The payload settles it: a learner with `total_cpe_credits: 152` and all three rungs `CLAIMED`
   * has `caira_cpe_credits: 0`, while the server's own `progress_label` reads `"152/90 Credits"`
   * against Level 3's threshold of 90. Feeding the hero `caira_cpe_credits` showed that learner
   * "0 CPE Credits" and an empty Level 1 bar.
   *
   * `caira_cpe_credits: 0` for someone who has claimed every CAIRA badge looks wrong backend-side
   * and is logged with them; this reads the field the thresholds are actually counted in rather
   * than waiting on that answer.
   */
  protected readonly earnedCredits = computed(() => this.api.data().cpe_summary.total_cpe_credits);

  /**
   * Which rung the hero opens on: the learner's current level, else the one they are working
   * toward. The ladder rows carry no per-rung progress of their own, so this is the server's
   * answer rather than something derived from the rows.
   */
  protected readonly focusLevel = computed(() => {
    const summary = this.api.data().cpe_summary;
    return (
      summary.current_level?.number ??
      summary.next_level?.number ??
      this.levels()[0]?.level.number ??
      1
    );
  });

  constructor() {
    redirectOnSessionLoss();
  }

  protected onActivate(card: MasterclassBadge): void {
    void this.actions.run(card);
  }

  protected retry(): void {
    this.api.reload();
  }
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { BadgeRow, BadgeRowSection } from '../../components/badge-row/badge-row';
import { CairaLevelHero } from '../../components/caira-level-hero/caira-level-hero';
import { CairaBadgesFacade } from '../../services/caira-badges-facade';

interface RowConfig {
  heading: string;
  section: BadgeRowSection;
  viewAllLink: string;
}

/**
 * CAIRA Progress home — the ladder hero over one rail per badge section. The hero and the
 * rails each inject the route's `CairaBadgesFacade`, so the page composes and owns only the
 * failure state they deliberately don't render.
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CairaTracker {
  private readonly facade = inject(CairaBadgesFacade);

  protected readonly rows: readonly RowConfig[] = [
    { heading: 'Webinar Badges', section: 'webinar_badges', viewAllLink: 'webinar-badges' },
    {
      heading: 'Masterclass Course Badges',
      section: 'masterclass_badges',
      viewAllLink: 'course-badges',
    },
  ];

  /**
   * The hero and the rails both hide themselves on a failed load, so without this the page
   * was a blank shell with no way back — which is exactly what the dead v2 endpoints left
   * behind. One visible error, owned here, rather than one per section.
   */
  protected readonly hasError = computed(() => !!this.facade.loadError());

  protected retry(): void {
    this.facade.reload();
  }
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BadgeRow } from './shared/components/badge-row/badge-row';
import { CairaLevelHero } from './shared/components/caira-level-hero/caira-level-hero';
import { BadgeCourseType } from '../../shared/core/models/caira-badge.model';

interface RowConfig {
  heading: string;
  courseType: BadgeCourseType;
  viewAllLink: string;
}

/**
 * CAIRA Progress home. Pure composition — every child owns its own fetch, so
 * there is no page-level state, no facade and nothing to inject here.
 *
 * The design draws two rows (webinar + masterclass); all four course types the
 * v2 API supports are surfaced per product's call.
 */
@Component({
  selector: 'app-caira-tracker',
  imports: [BadgeRow, CairaLevelHero],
  templateUrl: './caira-tracker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CairaTracker {
  protected readonly rows: readonly RowConfig[] = [
    { heading: 'Webinar Badges', courseType: 'webinar', viewAllLink: 'webinar-badges' },
    {
      heading: 'Masterclass Course Badges',
      courseType: 'masterclass',
      viewAllLink: 'course-badges',
    },
    { heading: 'Podcast Course Badges', courseType: 'podcast', viewAllLink: 'course-badges' },
    {
      heading: 'Nano-Learning Course Badges',
      courseType: 'nano_learning',
      viewAllLink: 'course-badges',
    },
  ];
}

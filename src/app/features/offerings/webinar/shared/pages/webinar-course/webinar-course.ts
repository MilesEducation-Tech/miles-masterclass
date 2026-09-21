import { Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CourseAbout } from '../../../../../../shared/components/course-about/course-about';
import { ContentAbout } from '../../../../../../shared/core/models/course.model';
import { UpcomingPremiere } from '../../../../../../shared/core/models/feature.model';
import { WebinarHero } from '../../components/webinar-hero/webinar-hero';

/**
 * ponytail: design-only shell. The webinar fetch/cache (WebinarFacade), the
 * auth gate and the `UpcomingPremiere -> ContentAbout` adapter were removed.
 * `webinar()` is permanently null, so the template renders its not-found /
 * empty design. Re-wire by restoring a facade lookup keyed off `courseId`.
 */
@Component({
  selector: 'app-webinar-course',
  imports: [RouterLink, WebinarHero, CourseAbout],
  templateUrl: './webinar-course.html',
  styleUrl: './webinar-course.css',
})
export class WebinarCourse {
  /**
   * Bound from the `:courseId` route segment via `withComponentInputBinding()`
   * ([app.config.ts](app/app.config.ts)). Must stay named `courseId` to match
   * the route param exactly — renaming either side silently breaks the binding.
   */
  readonly courseId = input<string>();

  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly webinar = signal<UpcomingPremiere | null>(null);
  protected readonly contentAbout = signal<ContentAbout | null>(null);
}

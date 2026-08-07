import { DatePipe, NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { faSolidArrowUpRightFromSquare } from '@ng-icons/font-awesome/solid';
import { logo } from '../../core/constant/icon';
import { CategoriesList } from '../categories-list/categories-list';
import { TotalCpeCreditsPipe } from '../../core/pipes/total-cpe-credits/total-cpe-credits.pipe';
import { DurationPipe } from '../../core/pipes/duration/duration-pipe';
import { Utils } from '../../core/services/utils/utils';
import { Router } from '@angular/router';
import { Dialog } from '../../core/services/dialog/dialog';

@Component({
  selector: 'app-course-about',
  imports: [NgIcon, DatePipe, NgOptimizedImage, CategoriesList, TotalCpeCreditsPipe, DurationPipe],
  templateUrl: './course-about.html',
  styleUrl: './course-about.css',
})
export class CourseAbout {
  card = input.required<any | any>();
  type = input<'masterclass' | 'podcast' | 'micro-learning' | 'webinar'>('masterclass');

  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  icons = signal({
    faSolidArrowUpRightFromSquare,
    logo,
  });

  /**
   * `course_duration` arrives from the API in minutes; split into whole hours
   * and remaining minutes for the two-cell display in the bento grid. Returns
   * zeros when the field is missing so the template can render without guards.
   */
  /**
   * Webinar attendance requirement in minutes. `attendance_threshold` arrives
   * as a percentage of `webinar_duration` (minutes) — surface the absolute
   * minutes the learner must attend rather than the raw percentage.
   */
  readonly webinarAttendanceMinutes = computed(() => {
    const c = this.card();
    const threshold = Number(c.attendance_threshold) || 0;
    const duration = Number(c.webinar_duration) || 0;
    return Math.round((threshold / 100) * duration);
  });

  readonly courseDurationParts = computed(() => {
    // The wire field can land as a fractional number (e.g. 549.52). Floor up
    // front so the modulo split doesn't surface IEEE-754 noise like
    // `9.520000000000005` in the Mins cell.
    const minutes = Math.floor(Number(this.card().course_duration) || 0);
    return {
      hours: Math.floor(minutes / 60),
      minutes: minutes % 60,
    };
  });

  onInstructorClick(i: { id: number; first_name: string; last_name: string }) {
    const slug = this.utils.slugify(`${i?.first_name} ${i?.last_name}`);
    const basePath = `/${this.utils.getRouteParams().country}/${this.utils.getRouteParams().profession}`;
    this.dialog.closeAll();
    this.router.navigate([`${basePath}/instructor`, i.id, slug]);
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matCalendarMonthRound } from '@ng-icons/material-icons/round';
import { phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';

import { Button } from '../../ui/button/button';
import { CategoriesList } from '../../categories-list/categories-list';
import { CourseAbout } from '../../course-about/course-about';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { MilesSlug } from '../../miles-slug/miles-slug';
import { ContentAbout } from '../../../core/models/course.model';
import { UpcomingPremiere, WebinarCta, WebinarTag } from '../../../core/models/feature.model';
import { Utils } from '../../../core/services/utils/utils';
import { DatePipe } from '@angular/common';
import { LocalTimeZonePipe } from '../../../core/pipes/local-time-zone/local-time-zone.pipe';

export interface WebinarDetailsDialogData {
  webinar: UpcomingPremiere;
  /** Legacy callback kept for callers that need to react to a book click. */
  onBook?: (webinar: UpcomingPremiere) => void;
}

/** Dialog close reasons. */
type DialogResult = 'closed' | 'book' | 'submit-feedback' | 'download-certificate';

/**
 * ponytail: design-only shell. The `WebinarFacade` lookup, the `about` fetch,
 * enrolment and the auth-dependent CTA tree were removed — the dialog now just
 * renders whatever `data.webinar` snapshot it was opened with. `share` and
 * `submitFeedback` still work because they are plain routing/URL helpers with
 * no auth or webinar-API dependency.
 */
@Component({
  selector: 'app-webinar-details-dialog',
  imports: [Button, CategoriesList, CourseAbout, DatePipe, MilesSlug, NgIcon, LocalTimeZonePipe],
  templateUrl: './webinar-details-dialog.html',
  styleUrl: './webinar-details-dialog.css',
  providers: [provideIcons({ matCalendarMonthRound, phosphorShareFatFill })],
})
export class WebinarDetailsDialog {
  dialogRef!: DialogRef<WebinarDetailsDialog, DialogResult>;
  data!: WebinarDetailsDialogData;

  private readonly utils = inject(Utils);

  protected readonly webinar = computed<UpcomingPremiere>(() => this.data.webinar);

  // ponytail: was `upcomingToContentAbout(webinar())`; the adapter went with
  // the webinar data layer, so the About block stays collapsed.
  protected readonly contentAbout = signal<ContentAbout | null>(null);

  // ponytail: was `nextSessionOf()` from the removed webinar status utils.
  protected readonly nextSession = computed(() => this.webinar().webinar_dates?.[0] ?? null);

  protected readonly isBooked = computed(
    () => !!this.webinar().registered_webinar?.user_enrollments,
  );

  // ponytail: inert — both were derived from webinar status + auth.
  protected readonly tag = signal<WebinarTag>('upcoming');
  protected readonly cta = signal<WebinarCta>('book');

  protected close(): void {
    this.dialogRef.close('closed');
  }

  /**
   * Open the shared "copy link" dialog with this webinar's absolute detail URL.
   * Built via `Utils.buildCourseUrl` so the link matches the route the webinar
   * card / hero would navigate to. Leaves this dialog open behind it.
   */
  protected share(): void {
    const w = this.webinar();
    const url = this.utils.buildCourseUrl('webinar', w.id, w.webinar_title);
    this.utils.openShareDialog({ url });
  }

  /** Enrolment is gone; still notify the legacy callback and close. */
  protected book(): void {
    this.data.onBook?.(this.webinar());
    this.dialogRef.close('book');
  }

  /** Open the live Zoom session in a new tab. */
  protected joinLive(): void {
    const w = this.webinar();
    const url =
      w.registered_webinar?.user_enrollments?.join_url ?? this.nextSession()?.join_url ?? null;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  /** Open the recording in a new tab. */
  protected watchRecording(): void {
    const url = this.webinar().video_recording;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  /** Navigate to the webinar feedback page, then close. */
  protected submitFeedback(): void {
    const w = this.webinar();
    this.utils.navigateToCourseFeedback('webinar', w.id, w.webinar_title);
    this.dialogRef.close('submit-feedback');
  }

  // ponytail: inert — the certificate dialog was opened through WebinarFacade.
  protected downloadCertificate(): void {
    this.dialogRef.close('download-certificate');
  }
}

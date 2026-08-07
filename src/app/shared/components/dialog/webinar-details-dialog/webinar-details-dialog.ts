import { Component, computed, inject, OnInit } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matCalendarMonthRound } from '@ng-icons/material-icons/round';
import { phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';

import { Button } from '../../ui/button/button';
import { CategoriesList } from '../../categories-list/categories-list';
import { CourseAbout } from '../../course-about/course-about';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { MilesSlug } from '../../miles-slug/miles-slug';
import { ContentAbout } from '../../../core/models/course.model';
import { UpcomingPremiere } from '../../../core/models/feature.model';
import { Auth } from '../../../core/services/auth/auth';
import { Utils } from '../../../core/services/utils/utils';
import {
  ctaFor,
  nextSessionOf,
  webinarTagFor,
  WebinarCta,
} from '../../../../features/offerings/webinar/shared/utils/webinar-status';
import { upcomingToContentAbout } from '../../../../features/offerings/webinar/shared/utils/upcoming-to-content';
import { WebinarFacade } from '../../../../features/offerings/webinar/shared/services/webinar-facade/webinar-facade';
import { DatePipe } from '@angular/common';
import { LocalTimeZonePipe } from '../../../core/pipes/local-time-zone/local-time-zone.pipe';

export interface WebinarDetailsDialogData {
  webinar: UpcomingPremiere;
  /**
   * Legacy callback kept for callers that need to react to a successful book.
   * If unset, the dialog enrolls (or opens the registration flow for guests)
   * via the injected `WebinarFacade` directly.
   */
  onBook?: (webinar: UpcomingPremiere) => void;
}

/** Dialog close reasons. */
type DialogResult = 'closed' | 'book' | 'submit-feedback' | 'download-certificate';

@Component({
  selector: 'app-webinar-details-dialog',
  imports: [Button, CategoriesList, CourseAbout, DatePipe, MilesSlug, NgIcon, LocalTimeZonePipe],
  templateUrl: './webinar-details-dialog.html',
  styleUrl: './webinar-details-dialog.css',
  providers: [provideIcons({ matCalendarMonthRound, phosphorShareFatFill })],
})
export class WebinarDetailsDialog implements OnInit {
  dialogRef!: DialogRef<WebinarDetailsDialog, DialogResult>;
  data!: WebinarDetailsDialogData;

  private readonly auth = inject(Auth);
  private readonly utils = inject(Utils);
  /**
   * Provided at the webinar route level. When the dialog is opened from
   * outside that route (e.g. a card mixed into another feature) the facade is
   * absent — book / certificate handlers no-op in that case rather than
   * throwing. The full CTA set is still visible so the user knows what
   * actions exist; they just need to enter the webinar surface to act.
   */
  private readonly facade = inject(WebinarFacade, { optional: true });

  /**
   * Reactive view of the webinar — re-derives from the facade's lists by id so
   * that CTA state stays in sync with `applyWebinarUpdate`. `data.webinar` is
   * a one-time snapshot taken at dialog-open; without this lookup, clicking
   * "Book Now" mutates the facade but the dialog keeps reading the stale
   * reference and never flips to "Booked".
   */
  protected readonly webinar = computed<UpcomingPremiere>(() => {
    const initial = this.data.webinar;
    if (!this.facade) return initial;
    // `findById` covers every rail. Do NOT inline a per-rail lookup here: this
    // computed only re-runs for the signals it reads, so a rail it misses means
    // the dialog silently sticks with the open-time snapshot and never shows
    // the `loadAbout` content until it's reopened.
    return this.facade.findById(initial.id) ?? initial;
  });
  protected readonly contentAbout = computed<ContentAbout>(() =>
    upcomingToContentAbout(this.webinar()),
  );

  /**
   * Pull the long-form content (`v2/webinar/:id/about/`) as soon as the dialog
   * opens. This lives here rather than at the call sites because every route
   * into this dialog needs it — `WebinarFacade.openDetails`, the hero's Learn
   * More, and the cards' info button via `Utils.openCourseInfoDialog`, which
   * bypasses the facade entirely. One place, no caller can forget.
   *
   * `loadAbout` is idempotent and pushes through `patchWebinar`, so the
   * `webinar()` computed above picks the content up with no further wiring.
   * Not in the constructor: `data` is assigned by `Dialog.open` after the
   * component is constructed, so `this.data` is undefined until `ngOnInit`.
   */
  ngOnInit(): void {
    const id = this.data?.webinar?.id;
    if (id != null) this.facade?.loadAbout(id);
  }
  protected readonly nextSession = computed(() => nextSessionOf(this.webinar()));
  protected readonly tag = computed(() => webinarTagFor(this.webinar()));
  protected readonly isBooked = computed(
    () => !!this.webinar().registered_webinar?.user_enrollments,
  );

  /**
   * Same CTA decision tree the hero / list item / card use, so the dialog's
   * action row stays in lockstep with every other webinar surface.
   */
  protected readonly cta = computed<WebinarCta>(() =>
    ctaFor(this.webinar(), this.auth.isLoggedIn()),
  );

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

  /**
   * Book / register flow. Mirrors `WebinarHero.book` + the unauthed branch in
   * `PremiereListItem.book`: signed-in users hit the enroll endpoint, guests
   * get the registration dialog. The legacy `onBook` callback still fires for
   * callers that need to observe the click.
   *
   * For actions that open a follow-up dialog or navigate (guest book, submit
   * feedback, download certificate) we dispatch the action FIRST and then
   * close — `dialogRef.close()` mutates internal state synchronously (adds
   * exit class, removes escape handler) which can race with the next action
   * if we close first.
   */
  protected book(): void {
    const w = this.webinar();
    this.data.onBook?.(w);
    if (!this.facade) {
      this.dialogRef.close('book');
      return;
    }
    if (!this.auth.isLoggedIn()) {
      this.facade.openRegistration(w);
      this.dialogRef.close('book');
      return;
    }
    this.facade.enroll(w).subscribe();
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

  /**
   * Navigate to the webinar feedback page via `Utils.navigateToCourseFeedback`
   * — same routing the cards / hero use. Navigate FIRST so the router has the
   * pending URL before the dialog tears down.
   */
  protected submitFeedback(): void {
    const w = this.webinar();
    this.utils.navigateToCourseFeedback('webinar', w.id, w.webinar_title);
    this.dialogRef.close('submit-feedback');
  }

  /**
   * Open the shared certificate download dialog, then close this one so the
   * follow-up dialog ends up on top without the close race.
   */
  protected downloadCertificate(): void {
    if (!this.facade) return;
    const w = this.webinar();
    this.facade.openCertificateDownloadDialog(w);
    this.dialogRef.close('download-certificate');
  }
}

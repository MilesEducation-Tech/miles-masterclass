import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet, NgOptimizedImage } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { finalize } from 'rxjs/operators';

import { Button } from '../../../../../../shared/components/ui/button/button';
import { CategoriesList } from '../../../../../../shared/components/categories-list/categories-list';
import { TotalCpeCreditsPipe } from '../../../../../../shared/core/pipes/total-cpe-credits/total-cpe-credits.pipe';
import { Auth } from '../../../../../../shared/core/services/auth/auth';
import { Logger } from '../../../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../../../shared/core/services/notification/notification';
import { Utils } from '../../../../../../shared/core/services/utils/utils';
import { UpcomingPremiere } from '../../../../../../shared/core/models/feature.model';
import { WebinarFacade } from '../../services/webinar-facade/webinar-facade';
import { ctaFor, formatStartsIn, nextSessionOf, webinarTagFor } from '../../utils/webinar-status';
import {
  WebinarRegistrationForm,
  WebinarRegistrationFormValue,
} from '../webinar-registration-form/webinar-registration-form';
import { heroVideoCameraSolid } from '@ng-icons/heroicons/solid';
import { phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';
import { CairaCredlyBadge } from '../../../../../../shared/components/cards/caira-credly-badge/caira-credly-badge';
import { LocalTimeZonePipe } from '../../../../../../shared/core/pipes/local-time-zone/local-time-zone.pipe';

/**
 * Zoom brand wordmark (Simple Icons, 24×24 viewBox). Stored as an SVG string so
 * `<ng-icon [svg]="zoomLogo">` can render it through the same pipeline the rest
 * of the app uses for custom marks (see `core/constant/icon.ts` for the
 * Masterclass logo, used the same way in CourseAbout). `currentColor` lets the
 * surrounding `text-accent` flow into the fill without a hardcoded brand colour.
 */
const ZOOM_LOGO = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><title>Zoom</title><path d="M5.033 14.649H.743a.74.74 0 0 1-.686-.458.74.74 0 0 1 .16-.808L3.19 10.41H1.06A1.06 1.06 0 0 1 0 9.35h3.957c.301 0 .57.18.686.458a.74.74 0 0 1-.161.808L1.51 13.59h2.464c.585 0 1.06.475 1.06 1.06zM24 11.338c0-1.14-.927-2.066-2.066-2.066-.61 0-1.158.265-1.537.686a2.061 2.061 0 0 0-1.536-.686c-1.14 0-2.066.926-2.066 2.066v3.311a1.06 1.06 0 0 0 1.06-1.06v-2.251a1.004 1.004 0 0 1 2.013 0v2.251c0 .586.474 1.06 1.06 1.06v-3.311a1.004 1.004 0 0 1 2.012 0v2.251c0 .586.475 1.06 1.06 1.06zM16.265 12a2.728 2.728 0 1 1-5.457 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0zm-4.82 0a2.728 2.728 0 1 1-5.458 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0z"/></svg>`;

@Component({
  selector: 'app-webinar-hero',
  imports: [
    Button,
    CategoriesList,
    DatePipe,
    NgIcon,
    NgTemplateOutlet,
    TotalCpeCreditsPipe,
    WebinarRegistrationForm,
    NgOptimizedImage,
    CairaCredlyBadge,
    LocalTimeZonePipe,
  ],
  templateUrl: './webinar-hero.html',
  styleUrl: './webinar-hero.css',
  providers: [provideIcons({ heroVideoCameraSolid, phosphorShareFatFill })],
})
export class WebinarHero {
  private readonly facade = inject(WebinarFacade);
  private readonly auth = inject(Auth);
  private readonly utils = inject(Utils);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);

  protected readonly zoomLogo = ZOOM_LOGO;
  readonly webinar = input.required<UpcomingPremiere>();
  /**
   * Hide the "Learn More" CTA in the auth-path card. Set `true` when the hero
   * is rendered on the webinar details page itself — opening the details
   * dialog from there shows the same content the page already displays.
   */
  readonly hideLearnMore = input(false);

  protected readonly tag = computed(() => webinarTagFor(this.webinar()));
  protected readonly nextSession = computed(() => nextSessionOf(this.webinar()));
  protected readonly instructor = computed(() => this.webinar().instructor_details);
  /**
   * Display name list — primary instructor first, then co-instructors from
   * `instructor_details.other_instructors` (may be undefined / empty).
   * Filters out blanks so a half-populated co-instructor doesn't render
   * a stray " " in the byline.
   */
  protected readonly instructorNames = computed(() => {
    const lead = this.instructor();
    const others = lead?.other_instructors ?? [];
    return [lead, ...others]
      .filter((person) => person?.first_name || person?.last_name)
      .map((person) => `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim());
  });
  protected readonly isBooked = computed(
    () => !!this.webinar().registered_webinar?.user_enrollments,
  );
  protected readonly isAuthed = computed(() => this.auth.isLoggedIn());
  /**
   * Full CTA decision (book / joined / join-live / submit-feedback /
   * download-certificate / watch-recording / ended). Used by the auth-path
   * button row to switch between Book Now, Booked, Join Live, Submit Feedback,
   * Download Certificate, and Watch Recording.
   */
  protected readonly cta = computed(() => ctaFor(this.webinar(), this.isAuthed()));
  /**
   * Attendance chip rendered on the hero thumbnail when the user is booked
   * and the API has recorded an outcome. `'Pending'` surfaces as an amber pill
   * **only after the webinar has ended** (last session's `end_date < now`,
   * derived from `tag()`); upcoming / live bookings stay quiet so cards don't
   * sprout a noisy pre-event pill. Colour cues mirror `Horizontal.attendanceTag`
   * for consistency across hero + carousel surfaces.
   */
  protected readonly attendanceTag = computed<{ label: string; classes: string } | null>(() => {
    const enrollment = this.webinar().registered_webinar?.user_enrollments;
    if (!enrollment) return null;
    switch (enrollment.attendance_status) {
      case 'Absent':
        return { label: 'Absent', classes: 'bg-red-500 text-white' };
      case 'Present':
        return { label: 'Present', classes: 'bg-green-500 text-white' };
      case 'Attended':
        return { label: 'Attended', classes: 'bg-emerald-500 text-white' };
      case 'Pending':
        return this.tag() === 'ended'
          ? { label: 'Pending', classes: 'bg-amber-500 text-white' }
          : null;
      default:
        return null;
    }
  });
  /**
   * Compact countdown label ("5 min" / "2 hr" / "3 days") for the upcoming
   * tag. Falls back to `null` once the session is live/ended — the existing
   * `tag()` switch then renders the live/ended chip instead.
   */
  protected readonly startsInLabel = computed<string | null>(() =>
    this.tag() === 'upcoming' ? formatStartsIn(this.nextSession()) : null,
  );

  /**
   * Best available artwork, `null` when the webinar has none at all. v2 cards
   * can ship with any of the three thumbnails blank, and binding an empty
   * string to `src` makes the browser re-request the current page URL and
   * render a broken-image icon — so callers must `@if` on these.
   */
  protected readonly thumbnail = computed<string | null>(() => {
    const w = this.webinar();
    return w.horizontal_thumbnail || w.vertical_thumbnail || w.square_thumbnail || null;
  });

  /** Square-first variant for the md+ ticket image. */
  protected readonly squareThumbnail = computed<string | null>(() => {
    const w = this.webinar();
    return w.square_thumbnail || w.horizontal_thumbnail || w.vertical_thumbnail || null;
  });

  /** Show CAiRA logo only when the webinar opts into the CAiRA programme. */
  protected readonly showCaira = computed(() => !!this.webinar().included_for_caira);
  /** Show Credly logo when a Credly-recognised individual badge ships. */
  protected readonly showCredly = computed(() => !!this.webinar().has_individual_badge);
  /** True if either credentialing wordmark is visible — drives the whole row. */
  protected readonly hasBadgeRow = computed(() => this.showCaira() || this.showCredly());

  /**
   * True while the enrol POST is in flight. Drives the Book Now button's
   * disabled + label state so a double-click can't fire two registrations —
   * the request takes long enough on a slow connection to be a real risk, and
   * the backend has no idempotency key.
   */
  protected readonly booking = signal(false);

  /**
   * Whether the primary CTA should be inert. Covers the in-flight booking and
   * the states that are terminal by definition.
   */
  protected readonly ctaDisabled = computed(
    () => this.booking() || this.cta() === 'joined' || this.cta() === 'ended',
  );

  protected book(): void {
    if (this.booking()) return;

    // Guard here as well as in the facade: the facade only toasts, and without
    // this the button would spin on a request that was never going to happen.
    const session = this.nextSession();
    if (!session) {
      this.notification.error(
        'No session available',
        'This webinar has no upcoming sessions to book. Please check back later.',
      );
      return;
    }

    this.booking.set(true);
    this.facade
      .enroll(this.webinar())
      .pipe(finalize(() => this.booking.set(false)))
      .subscribe({
        // `enroll` swallows its own failures (it toasts, then returns the
        // untouched webinar), so this only guards against an unexpected throw
        // upstream of that — without it the button would stay stuck disabled.
        error: (err) => {
          this.logger.error('WebinarHero.book: unexpected enrol failure', err);
          this.notification.error(
            'Booking failed',
            'Something went wrong while booking. Please try again.',
          );
        },
      });
  }

  protected openDetails(): void {
    this.facade.openDetails(this.webinar());
  }

  /**
   * Open the shared "copy link" dialog with this webinar's absolute detail URL.
   * Built via `Utils.buildCourseUrl` so the link matches the route the webinar
   * card / hero would navigate to.
   */
  protected share(): void {
    const w = this.webinar();
    const url = this.utils.buildCourseUrl('webinar', w.id, w.webinar_title);
    this.utils.openShareDialog({ url });
  }

  protected onGuestRegistration(payload: WebinarRegistrationFormValue): void {
    this.facade.registerAndEnroll(payload, this.webinar());
  }

  /**
   * Open a URL in a new tab, reporting the two ways it can fail instead of
   * doing nothing. Both were silent no-ops before, which reads to the user as
   * a dead button.
   *
   *  - no URL: the backend hasn't populated the link yet
   *  - `window.open` returns null: a popup blocker ate it, so tell the user
   *    what to do rather than leaving them clicking
   */
  private openExternal(url: string | null | undefined, label: string, missing: string): void {
    if (!url) {
      this.notification.error(`${label} unavailable`, missing);
      return;
    }
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened || opened.closed) {
        this.notification.info(
          'Popup blocked',
          `Your browser blocked the new tab. Allow popups for this site to ${label.toLowerCase()}.`,
        );
      }
    } catch (err) {
      this.logger.error(`WebinarHero.openExternal (${label}) failed`, err);
      this.notification.error(`Couldn't open ${label.toLowerCase()}`, 'Please try again.');
    }
  }

  /** Join the live Zoom session via the user's enrollment join URL. */
  protected joinLive(): void {
    const url =
      this.webinar().registered_webinar?.user_enrollments?.join_url ??
      this.nextSession()?.join_url ??
      null;
    this.openExternal(
      url,
      'Join link',
      "The join link isn't ready yet. It appears shortly before the session starts.",
    );
  }

  /** Open the recording in a new tab (only valid after the session ended). */
  protected watchRecording(): void {
    this.openExternal(
      this.webinar().video_recording,
      'Recording',
      'The recording for this webinar has not been published yet.',
    );
  }

  /**
   * Navigate to the webinar feedback page via `Utils.navigateToCourseFeedback`
   * so the URL is composed from the resolved country/profession + webinar
   * id/title — same routing the carousel cards and list items use. The
   * facade's `router.url`-based path would misroute when the hero is mounted
   * on the listing (`/.../webinar` → `/.../webinar/feedback`, an invalid
   * route) instead of the detail page.
   */
  protected submitFeedback(): void {
    const w = this.webinar();
    try {
      this.utils.navigateToCourseFeedback('webinar', w.id, w.webinar_title);
    } catch (err) {
      // `navigateToCourseFeedback` builds the URL from the resolved country /
      // profession; if either is missing the route won't resolve.
      this.logger.error('WebinarHero.submitFeedback: navigation failed', err);
      this.notification.error(
        "Couldn't open feedback",
        'Please try again from the webinar detail page.',
      );
    }
  }

  /** Open the shared certificate download dialog, scoped to this webinar. */
  protected downloadCertificate(): void {
    try {
      this.facade.openCertificateDownloadDialog(this.webinar());
    } catch (err) {
      this.logger.error('WebinarHero.downloadCertificate: dialog failed to open', err);
      this.notification.error(
        "Couldn't open certificate",
        'Something went wrong. Please try again.',
      );
    }
  }
}

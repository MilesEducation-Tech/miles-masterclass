import { Component, DestroyRef, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';

import { Button } from '../../../../../../shared/components/ui/button/button';
import { CategoriesList } from '../../../../../../shared/components/categories-list/categories-list';
import { Auth } from '../../../../../../shared/core/services/auth/auth';
import { Dialog } from '../../../../../../shared/core/services/dialog/dialog';
import { Logger } from '../../../../../../shared/core/services/logger/logger';
import { Webinars } from '../../services/webinar/webinar';
import { Utils } from '../../../../../../shared/core/services/utils/utils';
import { ctaFor, nextSessionOf } from '../../utils/webinar-status';
import { CairaCredlyBadge } from '../../../../../../shared/components/cards/caira-credly-badge/caira-credly-badge';

const CAIRA_LOGO =
  'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/caira-logo-white.webp';
const CREDLY_LOGO =
  'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/credly.webp';

@Component({
  selector: 'app-premiere-list-item',
  imports: [Button, CategoriesList, DatePipe, CairaCredlyBadge],
  templateUrl: './premiere-list-item.html',
  styleUrl: './premiere-list-item.css',
})
export class PremiereListItem {
  private readonly webinars = inject(Webinars);
  private readonly dialog = inject(Dialog);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(Auth);
  private readonly utils = inject(Utils);

  protected readonly cairaLogo = CAIRA_LOGO;
  protected readonly credlyLogo = CREDLY_LOGO;

  readonly webinar = input.required<any>();

  /**
   * Row artwork, `null` when the payload carries none. Falls back through the
   * instructor's images, which are only populated once the row has richer data
   * than the lean v2 card provides. Guarded with `@if` in the template — an
   * empty `src` re-requests the page URL and renders a broken-image icon.
   */
  protected readonly thumbnail = computed<string | null>(() => {
    const w = this.webinar();
    return (
      w.horizontal_thumbnail ||
      w.square_thumbnail ||
      w.vertical_thumbnail ||
      w.instructor_details?.horizontal_thumbnail ||
      w.instructor_details?.profile_image ||
      null
    );
  });

  protected readonly instructor = computed(() => this.webinar().instructor_details);

  protected readonly instructorNames = computed(() => {
    const lead = this.instructor();
    const others = lead?.other_instructors ?? [];
    return [lead, ...others]
      .filter((person) => person?.first_name || person?.last_name)
      .map((person) => `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim());
  });

  /** Show CAiRA logo only when the webinar opts into the CAiRA programme. */
  protected readonly showCaira = computed(() => !!this.webinar().included_for_caira);
  /** Show Credly logo when a Credly-recognised individual badge ships. */
  protected readonly showCredly = computed(() => !!this.webinar().has_individual_badge);
  /** True if either credentialing wordmark is visible — drives the whole row. */
  protected readonly hasBadgeRow = computed(() => this.showCaira() || this.showCredly());

  protected readonly session = computed(() => nextSessionOf(this.webinar()));
  protected readonly dayOrdinal = computed<string>(() => {
    const s = this.session();
    if (!s) return '';
    // Day-of-month in the visitor's local timezone so the suffix matches the
    // date pill (which renders via `DatePipe` with no timezone arg → local).
    const dayStr = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
    }).format(new Date(s.start_date));
    const day = Number.parseInt(dayStr, 10);
    const rem10 = day % 10;
    const rem100 = day % 100;
    if (rem10 === 1 && rem100 !== 11) return 'st';
    if (rem10 === 2 && rem100 !== 12) return 'nd';
    if (rem10 === 3 && rem100 !== 13) return 'rd';
    return 'th';
  });
  protected readonly isBooked = computed(
    () => !!this.webinar().registered_webinar?.user_enrollments,
  );
  /**
   * Compact CTA decision for the list row. Mirrors the hero's CTA logic so a
   * booked + ended + attended row that hasn't submitted feedback shows
   * "Submit Feedback", and one that has shows "Download Certificate".
   */
  protected readonly cta = computed(() => ctaFor(this.webinar(), this.auth.isLoggedIn()));

  /**
   * G-23 is closed: `registerV4/` (L3) plus its status poll (L4) are live and
   * already implemented by `Webinars.register()`. This used to call `enroll` on
   * a stub that returned `null`, so the Book button threw on every click.
   *
   * Guests cannot register directly — they get the dialog, which wraps the same
   * form the hero uses and carries the whole REGISTER → OTP → DONE machine.
   */
  protected book(): void {
    if (!this.auth.isLoggedIn()) {
      void this.openRegistrationDialog();
      return;
    }

    this.webinars
      .register(this.webinar().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // `accepted` means the attempt was still pending after the last poll —
        // the LMS treats that as booked rather than leaving the card spinning.
        next: (outcome) => {
          if (outcome === 'failed') {
            this.logger.warn('Webinar registration failed', this.webinar().id);
            return;
          }
          this.webinars.reload();
        },
        error: (error: unknown) => this.logger.error('Webinar registration errored', error),
      });
  }

  private async openRegistrationDialog(): Promise<void> {
    const { WebinarRegistrationDialog } =
      await import('../../../../../../shared/components/dialog/webinar-registration-dialog/webinar-registration-dialog');
    this.dialog.open(WebinarRegistrationDialog, {
      maxWidth: '100%',
      data: { webinar: this.webinar(), onRegistered: () => this.webinars.reload() },
    });
  }

  protected joinLive(): void {
    const url =
      this.webinar().registered_webinar?.user_enrollments?.join_url ??
      this.session()?.join_url ??
      null;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected watchRecording(): void {
    const url = this.webinar().video_recording;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Route via `Utils.navigateToCourseFeedback` so the URL gets built from the
   * resolved country/profession + webinar id/title, independent of where the
   * list item is mounted. The facade's `router.url`-based composition would
   * misroute on the listing page (`/.../webinar` → `/.../webinar/feedback`).
   */
  protected submitFeedback(): void {
    const w = this.webinar();
    this.utils.navigateToCourseFeedback('webinar', w.id, w.webinar_title);
  }

  /**
   * `Utils` owns the gating dialogs and the download dialog itself. CAIRA has no
   * bulk certificate endpoint, so the dialog reports that rather than posting to
   * a dead URL — but the entry point is real, not a stub that throws.
   */
  protected downloadCertificate(): void {
    this.utils.openCertificateDownloadDialog(this.webinar());
  }

  protected async openDetails(): Promise<void> {
    const { WebinarDetailsDialog } =
      await import('../../../../../../shared/components/dialog/webinar-details-dialog/webinar-details-dialog');
    this.dialog.open(WebinarDetailsDialog, {
      maxWidth: '100%',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      data: { webinar: this.webinar() },
    });
  }
}

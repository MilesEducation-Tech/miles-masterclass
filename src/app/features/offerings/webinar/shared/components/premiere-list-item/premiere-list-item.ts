import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';

import { Button } from '../../../../../../shared/components/ui/button/button';
import { CategoriesList } from '../../../../../../shared/components/categories-list/categories-list';
import { Auth } from '../../../../../../shared/core/services/auth/auth';
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
  // ponytail: WebinarFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly facade: any = {
    enroll: (..._args: any[]): any => null,
    openCertificateDownloadDialog: (..._args: any[]): any => null,
    openDetails: (..._args: any[]): any => null,
    openRegistration: (..._args: any[]): any => null,
  };
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

  protected book(): void {
    // Guests can't enroll directly — show the registration dialog so they can
    // sign up + (optionally) verify OTP first. `registerAndEnroll` then flips
    // the local state so the card re-renders into the booked variant.
    if (!this.auth.isLoggedIn()) {
      this.facade.openRegistration(this.webinar());
      return;
    }
    this.facade.enroll(this.webinar()).subscribe();
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

  protected downloadCertificate(): void {
    this.facade.openCertificateDownloadDialog(this.webinar());
  }

  protected openDetails(): void {
    this.facade.openDetails(this.webinar());
  }
}

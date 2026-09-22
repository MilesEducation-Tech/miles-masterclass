import { Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { Button } from '@shared/components/ui/button/button';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';
import { UpcomingPremiere, WebinarCta, WebinarDate } from '@core/models/feature.model';

const CAIRA_LOGO =
  'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/caira-logo-white.webp';
const CREDLY_LOGO =
  'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/credly.webp';

/**
 * ponytail: design-only shell — see `webinar-hero.ts`. Input-derived display
 * logic is real; enrolment, auth and dialog actions are inert.
 */
@Component({
  selector: 'app-premiere-list-item',
  imports: [Button, CategoriesList, DatePipe, CairaCredlyBadge],
  templateUrl: './premiere-list-item.html',
  styleUrl: './premiere-list-item.css',
})
export class PremiereListItem {
  protected readonly cairaLogo = CAIRA_LOGO;
  protected readonly credlyLogo = CREDLY_LOGO;

  readonly webinar = input.required<UpcomingPremiere>();

  /**
   * Row artwork, `null` when the payload carries none. Falls back through the
   * instructor's images. Guarded with `@if` in the template — an empty `src`
   * re-requests the page URL and renders a broken-image icon.
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

  // ponytail: was `nextSessionOf()` (first session still ahead of now); with no
  // data layer feeding this component the first date is an equivalent stand-in.
  protected readonly session = computed<WebinarDate | null>(
    () => this.webinar().webinar_dates?.[0] ?? null,
  );

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

  // ponytail: inert — was derived from auth + webinar status.
  protected readonly cta = signal<WebinarCta>('book');

  protected book(): void {
    // ponytail: inert
  }
  protected joinLive(): void {
    // ponytail: inert
  }
  protected watchRecording(): void {
    // ponytail: inert
  }
  protected submitFeedback(): void {
    // ponytail: inert
  }
  protected downloadCertificate(): void {
    // ponytail: inert
  }
  protected openDetails(): void {
    // ponytail: inert
  }
}

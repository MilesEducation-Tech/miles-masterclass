import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { logo } from '@core/constants/icon';
import { WebinarCard } from '../../models/webinar.model';

/** The sponsor id is a property of Miles, not of any one webinar. */
const NASBA_SPONSOR_ID = '149174';
const NASBA_LOGO = 'https://asset.milesmasterclass.com/media/web-app/home/nasba.webp';

/** One `label: value` row in the NASBA disclosure list. */
interface DisclosureRow {
  label: string;
  value: string;
}

/**
 * The detail page's centre column: about, learning objectives, and the NASBA
 * certifying-organisation disclosure.
 *
 * Ported from the v2 `app-course-about` and rebound to the v1 webinar card.
 * The two-column shape — a quarter-width heading against a three-quarter
 * content well — is that component's, as is the whole NASBA block's wording.
 *
 * Every disclosure line is rendered ONLY when its field is present. These are
 * regulatory statements a sponsor makes about a course, so an absent value has
 * to show as absent rather than as a default; see the note on the model.
 */
@Component({
  selector: 'app-webinar-about',
  imports: [NgIcon],
  templateUrl: './webinar-about.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarAbout {
  readonly webinar = input.required<WebinarCard>();

  protected readonly sponsorId = NASBA_SPONSOR_ID;
  protected readonly nasbaLogo = NASBA_LOGO;
  /** The inline wordmark the rest of the app already uses, not a remote asset. */
  protected readonly milesLogo = logo;

  /** Long copy when the backend sends it, the short line otherwise. */
  protected readonly about = computed(
    () => this.webinar().description || this.webinar().short_description || null,
  );

  protected readonly objectives = computed(
    () => this.webinar().webinar_what_will_you_learn_points ?? [],
  );

  /**
   * Whether there is a NASBA claim to make at all.
   *
   * v2 gated on credits being greater than zero, for the same reason: a
   * zero-credit session has no certifying organisation to name.
   */
  protected readonly hasCpe = computed(() => (this.webinar().cpe_credits ?? 0) > 0);

  /** `Finance 1 CPE | Auditing 2.3 CPE`, as the design renders the strip. */
  protected readonly fieldsOfStudy = computed(() =>
    this.webinar().fields_of_study.map((f) => ({ name: f.name, credit: f.cpe_credit })),
  );

  protected readonly disclosures = computed<DisclosureRow[]>(() => {
    const w = this.webinar();
    const rows: DisclosureRow[] = [
      { label: 'Sponsor Identification number', value: this.sponsorId },
    ];
    // Each is a regulatory statement, so absent stays absent.
    if (w.int_delivery_method) {
      rows.push({ label: 'Instructional Delivery Method', value: w.int_delivery_method });
    }
    if (w.program_level) rows.push({ label: 'Program Level', value: w.program_level });
    if (w.prerequisite_education) {
      rows.push({ label: 'Prerequisite Education', value: w.prerequisite_education });
    }
    if (w.advance_preparation) {
      rows.push({ label: 'Advanced Preparation', value: w.advance_preparation });
    }
    return rows;
  });

  protected readonly revisionDates = computed<DisclosureRow[]>(() => {
    const w = this.webinar();
    const rows: DisclosureRow[] = [];
    const push = (label: string, iso: string | null | undefined) => {
      if (!iso) return;
      const ms = Date.parse(iso);
      if (Number.isNaN(ms)) return;
      rows.push({
        label,
        value: new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(new Date(ms)),
      });
    };
    push('Created on', w.course_created_date);
    push('Reviewed on', w.course_reviewed_date);
    push('Updated on', w.course_updated_date);
    return rows;
  });

  /**
   * "To earn CPE credits…" — the two conditions v2 listed for a webinar.
   *
   * `attendance_threshold` is a PERCENTAGE of the duration; v2 converted it to
   * absolute minutes, because "attend at least 70%" is not something a learner
   * can act on mid-session.
   */
  protected readonly earningRules = computed<string[]>(() => {
    const w = this.webinar();
    const rules: string[] = [];
    if (w.no_question_answered) {
      rules.push(`Answer ${w.no_question_answered} poll questions during the webinar`);
    }
    const threshold = Number(w.attendance_threshold) || 0;
    const duration = Number(w.duration_minutes) || 0;
    if (threshold > 0 && duration > 0) {
      const minutes = Math.round((threshold / 100) * duration);
      rules.push(`Attend at least ${minutes} minutes of the ${duration} minute webinar`);
    }
    return rules;
  });
}

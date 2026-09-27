import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { logo } from '@core/constants/icon';
import { WebinarCard, WebinarDetail } from '../../models/webinar.model';

/** The sponsor id is a property of Miles, not of any one webinar. */
const NASBA_SPONSOR_ID = '149174';
const NASBA_LOGO = 'https://asset.milesmasterclass.com/media/web-app/home/nasba.webp';

/**
 * The detail page's centre column: about, learning objectives, and the NASBA
 * certifying-organisation disclosure.
 *
 * Ported from the v2 `app-course-about` and rebound to the v1 webinar card.
 * The two-column shape — a quarter-width heading against a three-quarter
 * content well — is that component's, as is the whole NASBA block's wording.
 *
 * The per-course NASBA disclosures the design lists (delivery method, program
 * level, prerequisites, advance preparation, revision dates, earning rules) are
 * NOT rendered: the Events API does not send them, and a regulatory statement
 * cannot be guessed. Add each back with its field once the events serializer
 * carries it. The sponsor id below is Miles's own, so it always renders.
 */
@Component({
  selector: 'app-webinar-about',
  imports: [NgIcon],
  templateUrl: './webinar-about.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarAbout {
  /** A feed card until the detail row lands; only the detail row has `description`. */
  readonly webinar = input.required<WebinarCard | WebinarDetail>();

  protected readonly sponsorId = NASBA_SPONSOR_ID;
  protected readonly nasbaLogo = NASBA_LOGO;
  /** The inline wordmark the rest of the app already uses, not a remote asset. */
  protected readonly milesLogo = logo;

  /** Long copy from the detail row, the card's short line otherwise. */
  protected readonly about = computed(() => {
    const w = this.webinar();
    return ('description' in w ? w.description : null) || w.short_description || null;
  });

  protected readonly objectives = computed(
    () => this.webinar().webinar_what_will_you_learn_points ?? [],
  );

  /**
   * Whether there is a NASBA claim to make at all.
   *
   * v2 gated on credits being greater than zero, for the same reason: a
   * zero-credit session has no certifying organisation to name.
   */
  protected readonly hasCpe = computed(() => (this.webinar().total_cpe_credits ?? 0) > 0);

  /** `Finance 1 CPE | Auditing 2.3 CPE`, as the design renders the strip. */
  protected readonly fieldsOfStudy = computed(() =>
    this.webinar().fields_of_study.map((f) => ({ name: f.name, credit: f.cpe_credit })),
  );
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { Button } from '@shared/ui/button/button';
import { ButtonVariant } from '@core/models/button.model';
import { Spinner } from '@shared/ui/spinner/spinner';
import { WebinarCard } from '../../models/webinar.model';
import { CTA_LABELS, needsCountdown, WebinarCta } from '../../utils/webinar-status';
import { parseIso } from '../../utils/session-time';
import { WebinarCountdown } from '../webinar-countdown/webinar-countdown';

/**
 * Renders whatever the CTA state machine decided, and nothing else.
 *
 * The `cta` is an INPUT — this component never computes it. That is the whole
 * point: `ctaFor()` is the single place a webinar's state is decided, so the
 * hero, the rails and the detail page cannot drift apart.
 */
@Component({
  selector: 'app-join-cta',
  imports: [Button, NgIcon, Spinner, WebinarCountdown],
  templateUrl: './join-cta.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JoinCta {
  readonly webinar = input.required<WebinarCard>();
  readonly cta = input.required<WebinarCta>();
  /**
   * Full-width, larger button — used by the hero and the detail page, where the
   * CTA is the page's primary action rather than one of a row of them.
   */
  readonly prominent = input(false);
  /**
   * Inline SVG to lead the button with, or `null` for none. A raw mark rather
   * than an `@ng-icons` name because these come from the design files, not a
   * pack — see `brand-assets.ts`.
   */
  readonly icon = input<string | null>(null);
  /**
   * Keep the button's own size preset (`h-10 px-4 py-2`) and a `rounded-md`
   * corner, which is the shape the v2 strip cards used. The default is the
   * newer design's chunkier 14px/24px box, which is right on a full-width row
   * but oversized on a ~300px card.
   */
  readonly dense = input(false);

  readonly register = output<void>();
  readonly join = output<void>();

  protected readonly label = computed(() => CTA_LABELS[this.cta()]);

  /** States where pressing the button does something. */
  protected readonly isActionable = computed(() => {
    const cta = this.cta();
    return cta === 'register' || cta === 'register-retry' || cta === 'join-open';
  });

  protected readonly isBusy = computed(() => this.cta() === 'registering');

  protected readonly variant = computed<ButtonVariant>(() =>
    this.cta() === 'join-open' ? 'primary' : 'default',
  );

  /**
   * Extra classes handed to `app-button`.
   *
   * Both forms take the design's 14px/24px padding and 8px radius rather than
   * the `size` preset's fixed `h-10 px-4 py-2` — `h-auto` is what lets the
   * padding define the height, and `twMerge` keeps these over the preset
   * because `cn()` puts the caller's classes last. The radius is a literal:
   * this project remaps the radius scale, so `rounded-lg` is 6px and
   * `rounded-xl` is 10px, and the design asks for 8.
   */
  private static readonly SHAPE = 'h-auto gap-2 rounded-[8px] px-6 py-3.5';

  protected readonly buttonClass = computed(() => {
    if (this.dense()) return 'gap-2 rounded-md';
    return this.prominent() ? `w-full text-base ${JoinCta.SHAPE}` : JoinCta.SHAPE;
  });

  protected readonly showCountdown = computed(() => needsCountdown(this.cta()));

  /**
   * The countdown runs to the SESSION START, not to the moment Join unlocks.
   *
   * "This webinar starts in 4 days" is the thing a registered learner wants to
   * know; "Join opens in 3 days and 23 hours" is the same instant expressed as
   * plumbing. The Join button still appears at start − `joinWindowMinutes`
   * (`ctaFor` owns that), so the two are independent: the countdown says when
   * the webinar is, the button says when you can get in.
   */
  protected readonly startsAt = computed(() => parseIso(this.webinar().start_date_time));

  /**
   * The explanatory line under the button.
   *
   * `join-pending-approval` is the one that matters: it is terminal on Zoom's
   * side, the reason travels in `error_message`, and there is nothing the user
   * can do — so it gets an explanation and never a retry.
   */
  protected readonly note = computed<string | null>(() => {
    const registration = this.webinar().registration;
    switch (this.cta()) {
      case 'join-pending-approval':
        return registration?.error_message ?? 'The host is reviewing your registration.';
      case 'register-retry':
        return registration?.error_message ?? 'No seat was taken. You can try again.';
      case 'live-elsewhere':
        return 'You are in this session in another window or on another device.';
      case 'not-eligible':
        return 'Attendance or engagement did not meet the CPE requirement.';
      default:
        return null;
    }
  });

  protected onClick(): void {
    if (this.cta() === 'join-open') this.join.emit();
    else this.register.emit();
  }
}

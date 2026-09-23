import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NotificationService } from '@core/services/notification/notification';
import { Spinner } from '@shared/ui/spinner/spinner';
import { WebinarAbout } from '../../components/webinar-about/webinar-about';
import { WebinarFaq } from '../../components/webinar-faq/webinar-faq';
import { WebinarHero } from '../../components/webinar-hero/webinar-hero';
import { WebinarFacade } from '../../services/webinar-facade';
import { WebinarRegistration } from '../../services/webinar-registration';
import { resolveJoinTarget } from '../../utils/join-target';
import { setupWebinarDetailSeo } from '../../utils/webinar-seo';

/**
 * One webinar in full: the landing page's banner over this session, the NASBA
 * disclosure block, then the same FAQ the landing page carries.
 *
 * Reads from the feed the list page already loaded rather than fetching a
 * detail endpoint — v1 has no per-webinar route, and every field this page
 * renders is on the card. On a cold deep link the facade's own resource
 * populates it a moment later.
 *
 * The banner is `app-webinar-hero`, unchanged. It already resolves its own CTA
 * through the state machine, so a past webinar reached at this URL shows the
 * right affordance without this page deciding anything.
 */
@Component({
  selector: 'app-webinar-detail',
  imports: [RouterLink, Spinner, WebinarAbout, WebinarFaq, WebinarHero],
  templateUrl: './webinar-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarDetail {
  /** Bound from the `:id` route param by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  private readonly facade = inject(WebinarFacade);
  private readonly registration = inject(WebinarRegistration);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notification = inject(NotificationService);
  /** Injected rather than reached for, so the external hop is testable. */
  private readonly window = inject(DOCUMENT).defaultView!;

  constructor() {
    // Tell the facade which webinar this page is showing. An `effect` rather
    // than a one-shot call because the router REUSES this component when only
    // `:id` changes (rail → detail → another detail), and a constructor-time
    // read would pin the first id forever.
    effect(() => this.facade.showDetail(this.id()));
    this.destroyRef.onDestroy(() => this.facade.showDetail(null));

    setupWebinarDetailSeo({ webinar: this.webinar, isMissing: this.isMissing });
  }

  /**
   * Prefer the feed row when it is already in memory — arriving from a rail
   * then renders instantly instead of flashing a spinner — and fall back to the
   * detail endpoint, which is the only source on a deep link or for a crawler.
   * The detail row wins once it lands: it carries four keys the card does not.
   */
  protected readonly webinar = computed(
    () => this.facade.detailWebinar() ?? this.facade.findById(this.id()),
  );

  protected readonly isLoading = computed(
    () => (this.facade.isLoading() || this.facade.isDetailLoading()) && !this.webinar(),
  );

  /** The endpoint answered "no such webinar", as opposed to "not loaded yet". */
  protected readonly isMissing = computed(() => !this.webinar() && this.facade.isDetailMissing());

  protected readonly isRegistering = computed(() => this.registration.isRegistering(this.id()));

  protected onRegister(): void {
    void this.facade.register(this.id());
  }

  protected onJoin(): void {
    const target = resolveJoinTarget(this.webinar());

    switch (target.kind) {
      case 'embedded':
        void this.router.navigate(['live'], { relativeTo: this.route });
        break;
      case 'external':
        // `noopener` is not optional on a `_blank` to a third party: without it
        // Zoom's tab gets a handle on `window.opener` and can navigate us.
        this.window.open(target.url, '_blank', 'noopener,noreferrer');
        break;
      case 'unavailable':
        this.notification.error(
          'That session is not ready yet',
          'We could not find a join link for this webinar. Refresh in a moment, or contact support if it persists.',
        );
        break;
    }
  }
}

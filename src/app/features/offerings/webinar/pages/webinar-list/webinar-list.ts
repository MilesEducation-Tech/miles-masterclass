import { ChangeDetectionStrategy, Component, DOCUMENT, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NotificationService } from '@core/services/notification/notification';
import { WebinarFaq } from '../../components/webinar-faq/webinar-faq';
import { WebinarHero } from '../../components/webinar-hero/webinar-hero';
import { WebinarMeetCta } from '../../components/webinar-meet-cta/webinar-meet-cta';
import { WebinarRail } from '../../components/webinar-rail/webinar-rail';
import { WebinarFacade } from '../../services/webinar-facade';
import { resolveJoinTarget } from '../../utils/join-target';
import { WebinarRegistration } from '../../services/webinar-registration';

/**
 * The webinar landing page: a highlighted hero over four rails.
 *
 * Everything on this page comes from ONE `webinar-main-page` call. The five
 * buckets are always present in the response — empty rather than omitted — so
 * signed-out simply renders the two public rails and the per-user ones fall
 * away on their own.
 */
@Component({
  selector: 'app-webinar-list',
  imports: [WebinarFaq, WebinarHero, WebinarMeetCta, WebinarRail],
  templateUrl: './webinar-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarList {
  protected readonly facade = inject(WebinarFacade);
  protected readonly auth = inject(AuthSession);
  private readonly registration = inject(WebinarRegistration);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notification = inject(NotificationService);
  /** Injected rather than reached for, so the external hop is testable. */
  private readonly window = inject(DOCUMENT).defaultView!;

  protected readonly registeringIds = computed(() => this.registration.inFlight());

  /**
   * Signed out: the three per-user rails cannot be populated, so say why.
   *
   * It has to be the SESSION that decides this, not whether those buckets have
   * rows: `missed_webinar` comes back populated for an anonymous caller too,
   * and a visitor with no account has not "missed" anything — every past
   * session would qualify. `isPreview` is always false outside a development
   * build, and the branch is stripped from production bundles.
   */
  protected readonly isSignedOut = computed(
    () => !this.auth.isAuthenticated() && !this.facade.isPreview(),
  );

  protected onRegister(webinarId: string): void {
    void this.facade.register(webinarId);
  }

  protected onJoin(webinarId: string): void {
    const target = resolveJoinTarget(this.facade.findById(webinarId));

    switch (target.kind) {
      case 'embedded':
        // The live room is its own route: it is client-rendered, holds the
        // session lease for exactly as long as it is mounted, and tears the SDK
        // down on navigation away. Opening the meeting in place would tie all
        // of that to the lifetime of the feed.
        void this.router.navigate([webinarId, 'live'], { relativeTo: this.route });
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

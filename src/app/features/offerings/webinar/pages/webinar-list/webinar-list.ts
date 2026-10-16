import { Component, computed, inject } from '@angular/core';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Faq } from '@shared/components/faq/faq';
import { WebinarHero } from '@features/offerings/webinar/components/webinar-hero/webinar-hero';
import { WebinarMeetCta } from '@features/offerings/webinar/components/webinar-meet-cta/webinar-meet-cta';
import { WebinarRail } from '@features/offerings/webinar/components/webinar-rail/webinar-rail';
import { WebinarFacade } from '@features/offerings/webinar/services/webinar-facade';
import { WebinarRegistration } from '@features/offerings/webinar/services/webinar-registration';

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
  imports: [Faq, WebinarHero, WebinarMeetCta, WebinarRail],
  templateUrl: './webinar-list.html',
})
export class WebinarList {
  protected readonly facade = inject(WebinarFacade);
  protected readonly auth = inject(AuthSession);
  private readonly registration = inject(WebinarRegistration);

  protected readonly registeringIds = computed(() => this.registration.inFlight());

  /**
   * Signed out: the three per-user rails cannot be populated, so say why.
   *
   * It has to be the SESSION that decides this, not whether those buckets have
   * rows: `missed_webinar` comes back populated for an anonymous caller too,
   * and a visitor with no account has not "missed" anything — every past
   * session would qualify.
   */
  protected readonly isSignedOut = computed(() => !this.auth.isAuthenticated());

  /**
   * A member registers in place; a guest goes to that webinar's page, where
   * its own seat form takes focus. The facade owns the decision.
   */
  protected onRegister(webinarId: string): void {
    void this.facade.book(webinarId);
  }

  /** Sign-in, then the live room or Zoom: the facade owns the whole decision. */
  protected onJoin(webinarId: string): void {
    void this.facade.join(webinarId);
  }
}

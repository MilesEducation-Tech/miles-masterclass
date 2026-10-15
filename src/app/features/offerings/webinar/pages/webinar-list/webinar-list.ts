import { Component, DOCUMENT, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Faq } from '@shared/components/faq/faq';
import { WebinarHero } from '@features/offerings/webinar/components/webinar-hero/webinar-hero';
import { WebinarMeetCta } from '@features/offerings/webinar/components/webinar-meet-cta/webinar-meet-cta';
import { WebinarRail } from '@features/offerings/webinar/components/webinar-rail/webinar-rail';
import { WebinarFacade } from '@features/offerings/webinar/services/webinar-facade';

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
  private readonly route = inject(ActivatedRoute);
  private readonly window = inject(DOCUMENT).defaultView!;

  /**
   * Signed out: the three per-user rails cannot be populated, so say why.
   *
   * It has to be the SESSION that decides this, not whether those buckets have
   * rows: `missed_webinar` comes back populated for an anonymous caller too,
   * and a visitor with no account has not "missed" anything — every past
   * session would qualify.
   */
  protected readonly isSignedOut = computed(() => !this.auth.isAuthenticated());

  protected onRegister(webinarId: string): void {
    // A guest's seat is booked from the hero card (sign in + register), so
    // "Book Now" on a row takes them there rather than to a dialog. With no
    // hero on the page the facade's sign-in prompt is still the fallback.
    if (this.isSignedOut() && this.facade.heroWebinar() && this.focusSeatForm()) return;
    void this.facade.register(webinarId);
  }

  /** Scroll the guest hero's seat form into view and focus it. */
  private focusSeatForm(): boolean {
    const field = this.window.document.getElementById('seat-identifier');
    if (!field) return false;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.focus({ preventScroll: true });
    return true;
  }

  protected onJoin(webinarId: string): void {
    this.facade.join(webinarId, this.route);
  }
}

import { Component, DestroyRef, computed, effect, inject, input } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Faq } from '@shared/components/faq/faq';
import { Spinner } from '@shared/ui/spinner/spinner';
import { WebinarAbout } from '@features/offerings/webinar/components/webinar-about/webinar-about';
import { WebinarHero } from '@features/offerings/webinar/components/webinar-hero/webinar-hero';
import { WebinarFacade } from '@features/offerings/webinar/services/webinar-facade';
import { setupWebinarDetailSeo } from '@features/offerings/webinar/utils/webinar-seo';

/**
 * One webinar in full: the landing page's banner over this session, the NASBA
 * disclosure block, then the same FAQ the landing page carries.
 *
 * Reads from the feed the list page already loaded rather than fetching a
 * detail endpoint — v1 has no per-webinar route, and every field this page
 * renders is on the card. On a cold deep link the facade's own resource
 * populates it a moment later.
 *
 * The banner is `app-webinar-hero`, which resolves its own CTA through the state
 * machine. The details payload carries no bucket and no `eligible`, so this page
 * hands it both from the feed; with no feed row (a cold deep link) the state
 * machine still never offers registration for a session that is over.
 */
@Component({
  selector: 'app-webinar-detail',
  imports: [Faq, RouterLink, Spinner, WebinarAbout, WebinarHero],
  templateUrl: './webinar-detail.html',
})
export class WebinarDetail {
  /** Bound from the `:id` route param by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  private readonly facade = inject(WebinarFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Tell the facade which webinar this page is showing. An `effect` rather
    // than a one-shot call because the router REUSES this component when only
    // `:id` changes (rail → detail → another detail), and a constructor-time
    // read would pin the first id forever.
    effect(() => this.facade.showDetail(this.id()));
    this.destroyRef.onDestroy(() => this.facade.showDetail(null));

    setupWebinarDetailSeo({ webinar: this.webinar, isMissing: this.isMissing });
  }

  /** Which row to show and which bucket decides its CTA: `WebinarFacade.detailFor`. */
  private readonly view = computed(() => this.facade.detailFor(this.id()));
  protected readonly webinar = computed(() => this.view().webinar);
  protected readonly bucket = computed(() => this.view().bucket);

  protected readonly isLoading = computed(
    () => (this.facade.isLoading() || this.facade.isDetailLoading()) && !this.webinar(),
  );

  /** The endpoint answered "no such webinar", as opposed to "not loaded yet". */
  protected readonly isMissing = computed(() => !this.webinar() && this.facade.isDetailMissing());

  protected onRegister(): void {
    void this.facade.register(this.id());
  }

  protected onJoin(): void {
    this.facade.join(this.id(), this.route);
  }
}

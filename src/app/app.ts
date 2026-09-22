import { Component, inject, signal, PendingTasks, afterNextRender } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { LoadingService } from './shared/core/services/loading/loading';
import { ConsentBanner } from './shared/components/consent-banner/consent-banner';
import { Progress } from './shared/components/ui/progress/progress';
import { SeoManager } from './shared/core/services/seo/seo-manager';
import { Analytics } from './shared/core/services/analytics/analytics';
import { EngagementDialog } from './shared/core/services/engagement-dialog/engagement-dialog';
import { Utm } from './shared/core/services/utm/utm';
import {
  isDynamicSlug,
  routeUrlToCanonicalUrl,
  routeUrlToSeoSlug,
} from './shared/utils/seo/seo-route-slug';
import { buildSiteStructuredData } from './shared/utils/seo/structured-data';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConsentBanner, Progress],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('Miles Masterclass');
  protected readonly loading = inject(LoadingService);
  private readonly seoManager = inject(SeoManager);
  private readonly engagement = inject(EngagementDialog);
  private readonly analytics = inject(Analytics);
  private readonly utm = inject(Utm);
  private readonly doc = inject(DOCUMENT);

  private readonly pendingTasks = inject(PendingTasks);

  private readonly router = inject(Router);

  /** Public origin (no trailing slash) for canonical / og:url tags. */
  private readonly siteUrl = environment.SITE_URL.replace(/\/+$/, '');

  /**
   * Site-wide structured data (Organization + EducationalOrganization +
   * WebSite). Anchored to the configured origin so it advertises the right
   * domain per build (.com prod / .us UAT). Emitted on every static page so the
   * SSR HTML is no longer schema-less (audit: Schema 0/100).
   */
  private readonly siteJsonLd = buildSiteStructuredData(this.siteUrl);

  /**
   * Brand-level fallback used by every static route. We pass it as the
   * fallback to `loadFromSupabase` rather than calling `setSeo` eagerly —
   * doing both would write the meta tags twice on first paint. `canonicalUrl`
   * and `openGraph.url` are filled in per-route in the navigation handler.
   */
  private readonly defaultSeo = {
    title: 'Miles Masterclass - AI-Powered CPE Training for Accounting Professionals',
    description:
      "Finally, CPE that's all about AI in Accounting. Master Classes, Podcasts, Reels & Live Premieres.",
    image: 'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/index.webp',
    twitter: {
      card: 'summary_large_image' as const,
      site: '@MilesEducation',
      creator: '@MilesEducation',
      imageAlt: 'Miles Masterclass - AI-Powered CPE Training Platform',
    },
    openGraph: {
      type: 'website' as const,
      site_name: 'Miles Masterclass',
    },
    jsonLd: this.siteJsonLd,
  };

  constructor() {
    this.engagement.start();

    // Capture the `?dXRt=` campaign token on first browser paint (browser-only
    // via afterNextRender) → cookie + backend report + URL cleanup.
    afterNextRender(() => this.utm.capture());

    // Listen to route changes and update SEO. The leaf component owns SEO
    // for any "dynamic" prefix listed in DYNAMIC_SLUG_PREFIXES — those pages
    // build a fallback config from live data and call loadFromSupabase
    // themselves, so we skip them here to avoid two competing setSeo calls.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event: NavigationEnd) => {
        const slug = routeUrlToSeoSlug(event.urlAfterRedirects);
        if (isDynamicSlug(slug)) {
          // Dynamic pages set their own SEO/title in the leaf component. Fire the
          // pageview here so the route is still tracked (page_path is correct;
          // page_title may lag one navigation — refine in the leaf if needed).
          this.analytics.trackPageView(event.urlAfterRedirects);
          return;
        }

        // Self-referencing canonical (locale collapsed onto the canonical
        // prefix) + matching og:url, applied to every static route. Passed in
        // the fallback so a page with no/empty Supabase row still emits them;
        // `loadFromSupabase` also backfills these onto a row that left them
        // blank (see SeoManager).
        const canonicalUrl = routeUrlToCanonicalUrl(event.urlAfterRedirects, this.siteUrl);
        const seoForRoute = {
          ...this.defaultSeo,
          canonicalUrl,
          openGraph: { ...this.defaultSeo.openGraph, url: canonicalUrl },
        };

        const releaseToken = this.pendingTasks.add();
        this.seoManager.loadFromSupabase(slug, seoForRoute).finally(() => {
          // Pageview after SEO resolves so document.title is correct.
          this.analytics.trackPageView(event.urlAfterRedirects, this.doc.title);
          releaseToken();
        });
      });
  }
}

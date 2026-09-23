import { DestroyRef, Signal, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SEO_BRAND_DEFAULTS } from '@core/models/seo.constants';
import { SeoConfig } from '@core/models/seo.models';
import { SeoManager } from '@core/services/seo/seo-manager';
import { routeUrlToCanonicalUrl } from '@shared/utils/seo/seo-route-slug';
import { environment } from '@env/environment';
import { WebinarCard } from '../models/webinar.model';

/** Trailing slash stripped, exactly as `app.ts` does before building a canonical. */
const SITE_ORIGIN = environment.SITE_URL.replace(/\/+$/, '');

export interface WebinarDetailSeoOptions {
  /** The webinar being shown, or `null` while loading / when missing. */
  webinar: Signal<WebinarCard | null>;
  /** The endpoint answered "no such webinar" — as opposed to "not yet". */
  isMissing: Signal<boolean>;
}

/**
 * SEO for one webinar's detail page.
 *
 * Deliberately NOT `setupCourseSeo`. That helper is slug-driven (it derives a
 * title from `:courseTitle` and looks the slug up in Supabase `seo_pages`),
 * and it emits `Course` structured data. A webinar's URL carries no slug, and a
 * scheduled session with a start time, a duration and a registration is an
 * `Event` in schema.org — describing it as a `Course` would be wrong data, not
 * merely a different shape.
 *
 * Must be called from an injection context (a component constructor).
 */
export function setupWebinarDetailSeo({ webinar, isMissing }: WebinarDetailSeoOptions): void {
  const seo = inject(SeoManager);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);

  effect(() => {
    if (isMissing()) {
      // A styled "we could not find that webinar" body served as 200 is a soft
      // 404, which search engines treat worse than an honest one: the URL gets
      // indexed as a real page with boilerplate content. `noindex` is the part
      // of the answer a client can give on its own.
      seo.setSeo({
        title: `Webinar not found | ${SEO_BRAND_DEFAULTS.publisher}`,
        description: 'This webinar is no longer available.',
        robots: 'noindex, follow',
      });
      return;
    }

    const url = routeUrlToCanonicalUrl(router.url, SITE_ORIGIN);
    const w = webinar();

    // Never leave the page bare. `webinar/` is in `DYNAMIC_SLUG_PREFIXES`, so
    // the app-level Supabase lookup deliberately steps aside here and this is
    // the ONLY thing writing tags for the route. Without a fallback, a page
    // still loading — or one whose fetch failed — would serve no title and no
    // robots directive at all, which is worse than a generic one.
    seo.setSeo(w ? buildWebinarSeo(w, url) : brandFallback(url));
  });

  // Leaf page: clear its tags on the way out so the next route does not
  // inherit this webinar's title and Event block.
  destroyRef.onDestroy(() => seo.reset());
}

/**
 * What to serve before the row arrives, and if it never does. Indexable: the
 * URL is a real page, it simply has nothing specific to say yet. A confirmed
 * 404 is handled separately and goes `noindex`.
 */
function brandFallback(canonicalUrl: string): SeoConfig {
  const description = `Live, accredited CPE webinars on ${SEO_BRAND_DEFAULTS.publisher}.`;
  return {
    title: `Webinar | ${SEO_BRAND_DEFAULTS.publisher}`,
    description,
    canonicalUrl,
    image: SEO_BRAND_DEFAULTS.fallbackImage,
    openGraph: { title: 'Webinar', description, url: canonicalUrl, type: 'website' },
  };
}

function buildWebinarSeo(w: WebinarCard, canonicalUrl: string): SeoConfig {
  const description =
    w.short_description ||
    w.description ||
    `Join "${w.name}" — a live CPE session on ${SEO_BRAND_DEFAULTS.publisher}.`;
  const image = w.horizontal_thumbnail || w.square_image || w.vertical_thumbnail || undefined;

  return {
    title: `${w.name} | ${SEO_BRAND_DEFAULTS.publisher}`,
    description,
    canonicalUrl,
    image,
    openGraph: {
      title: w.name,
      description,
      url: canonicalUrl,
      image,
      // `video` is the closest og:type the platform allows for a live session;
      // there is no `event` in the validated list.
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: w.name, description, image },
    jsonLd: buildEventJsonLd(w, canonicalUrl, description, image),
  };
}

/**
 * schema.org `Event`. Only fields the row actually carries are emitted — a
 * structured-data block with invented values is worse than a smaller true one,
 * and Google flags the invented ones.
 */
function buildEventJsonLd(
  w: WebinarCard,
  url: string,
  description: string,
  image: string | undefined,
): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: w.name,
    description,
    url,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    organizer: {
      '@type': 'Organization',
      name: SEO_BRAND_DEFAULTS.publisher,
      url: SITE_ORIGIN,
    },
    location: { '@type': 'VirtualLocation', url },
  };

  if (image) jsonLd['image'] = image;
  if (w.start_date_time) jsonLd['startDate'] = w.start_date_time;
  if (w.end_date_time) jsonLd['endDate'] = w.end_date_time;

  return jsonLd;
}

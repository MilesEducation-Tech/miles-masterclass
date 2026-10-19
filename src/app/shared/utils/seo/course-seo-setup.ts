import { isPlatformServer } from '@angular/common';
import { DestroyRef, effect, inject, PendingTasks, PLATFORM_ID, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { environment } from '@env/environment';
import {
  COURSE_BRAND_NAMES,
  COURSE_DESCRIPTION_VERBS,
  SEO_BRAND_DEFAULTS,
} from '@core/models/seo.constants';
import { SeoConfig } from '@core/models/seo.models';
import { SeoManager } from '@core/services/seo/seo-manager';
import { courseToSeoConfig, type CourseSeoKind, type CourseSeoSource } from './course-seo-config';
import { routeUrlToCanonicalUrl, routeUrlToSeoSlug } from './seo-route-slug';

export interface CourseSeoSetupOptions {
  /** Course kind — drives brand, description verb, and `courseToSeoConfig` mapping. */
  kind: CourseSeoKind;
  /** Route-input slug (e.g. `think-plan-grow-with-ai`). */
  courseTitle: Signal<string | undefined>;
  /** Live course details from the facade — only used to upgrade the fallback. */
  courseDetails: Signal<CourseSeoSource | null>;
}

/**
 * Wires up the SEO lifecycle for a dynamic course detail page (masterclass /
 * podcast / micro-learning). Must be called from a component constructor
 * (injection context).
 *
 * What it does, all from one effect (the route inputs are bound by the time
 * it first runs; in the constructor `courseTitle()` is still `undefined`,
 * which is how every course page shipped the brand name as its title):
 * 1. **Early paint** — Once per slug, applies the URL-derived fallback
 *    (title from the slug, canonical, `og:url`) before any async work.
 * 2. **Slug-driven Supabase lookup** — Fires `loadFromSupabase(slug, fallback)`
 *    the moment the slug is known, *without* waiting for `courseDetails()`,
 *    so a slow or errored course backend can't hold SSR past Supabase's own
 *    4.5s server-side timeout.
 * 3. **Course-driven fallback upgrade** — When `courseDetails()` lands, the
 *    same effect re-fires with a richer fallback (name, description, image,
 *    trailer). The Supabase row still wins field by field, and `SeoManager`
 *    fills its `{{tokens}}` and blank fields from this fallback.
 * 4. **SSR gate** — Each load holds its own `PendingTasks` entry on the
 *    server until it settles. The course load aborts the URL load, and a
 *    single shared gate used to be released by that abort, so SSR serialized
 *    before the course load wrote anything. Now the superseding load keeps
 *    the app unstable until its own tags are written.
 * 5. On destroy, `seoManager.reset()` clears the page's meta tags so the
 *    next route doesn't inherit stale OG/Twitter values.
 *
 * The component remains responsible for triggering the actual
 * `facade.loadCourse(...)` call — that's a facade concern, not a SEO one.
 */
export function setupCourseSeo({ kind, courseTitle, courseDetails }: CourseSeoSetupOptions): void {
  const seoManager = inject(SeoManager);
  const router = inject(Router);
  const pendingTasks = inject(PendingTasks);
  const destroyRef = inject(DestroyRef);
  const isServer = isPlatformServer(inject(PLATFORM_ID));

  const brandName = COURSE_BRAND_NAMES[kind];
  const verb = COURSE_DESCRIPTION_VERBS[kind];

  // The URL, as a signal, so the effect below re-runs on route reuse — a
  // `let`-captured closure value would not be tracked.
  const currentUrl = toSignal(
    router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: router.url },
  );

  // Fires once per slug with the URL-derived fallback, and again when
  // `courseDetails` lands with the course-derived one. `SeoManager` aborts the
  // previous in-flight call and serves both from one Supabase read.
  let lastSeoKey: string | null = null;
  let paintedSlug: string | null = null;
  effect(() => {
    const url = currentUrl();
    const slug = routeUrlToSeoSlug(url);
    if (!slug) return;
    const course = courseDetails();
    const key = `${slug}|${course ? `c-${course.id}` : 'url'}`;
    if (key === lastSeoKey) return;
    lastSeoKey = key;

    const canonicalUrl = routeUrlToCanonicalUrl(url, environment.SITE_URL);
    const fallback = course
      ? courseToSeoConfig(course, kind, canonicalUrl)
      : urlDerivedSeo(courseTitle(), canonicalUrl, brandName, verb);

    if (paintedSlug !== slug) {
      paintedSlug = slug;
      seoManager.setSeo(fallback);
    }

    // Server only: hold SSR until THIS load settles. Bounded by
    // `loadFromSupabase`'s own timeout (4.5s on the server).
    const settle: () => void = isServer ? pendingTasks.add() : () => undefined;
    void seoManager.loadFromSupabase(slug, fallback).finally(settle);
  });

  // Clear any meta tags this page wrote so the next route doesn't inherit
  // stale OG/Twitter values from the previous course.
  destroyRef.onDestroy(() => seoManager.reset());
}

/**
 * The fallback before (or without) the course record: a title read from the
 * URL slug, the brand image, and the page's canonical. A slow or failing
 * course backend leaves this as the page's SEO, so it must stand on its own.
 */
function urlDerivedSeo(
  slug: string | undefined,
  canonicalUrl: string,
  brandName: string,
  verb: string,
): SeoConfig {
  const title = courseTitleFromSlug(slug) ?? brandName;
  const description = `${verb} "${title}" on ${brandName} — AI-driven CPE for accounting professionals.`;
  return {
    title,
    description,
    image: SEO_BRAND_DEFAULTS.fallbackImage,
    canonicalUrl,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: SEO_BRAND_DEFAULTS.ogType,
      site_name: brandName,
    },
    twitter: {
      card: SEO_BRAND_DEFAULTS.twitterCard,
      title,
      description,
      site: SEO_BRAND_DEFAULTS.twitterSite,
      creator: SEO_BRAND_DEFAULTS.twitterCreator,
    },
  };
}

/**
 * Convert a URL slug like `think-plan-grow-with-ai` into a readable title
 * (`Think Plan Grow With Ai`) for the early-paint `setSeo`.
 */
function courseTitleFromSlug(slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

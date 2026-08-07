import { isPlatformServer } from '@angular/common';
import { DestroyRef, effect, inject, PendingTasks, PLATFORM_ID, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import {
  COURSE_BRAND_NAMES,
  COURSE_DESCRIPTION_VERBS,
  SEO_BRAND_DEFAULTS,
} from '../../core/models/seo.constants';
import { SeoConfig } from '../../core/models/seo.models';
import { SeoManager } from '../../core/services/seo/seo-manager';
import { courseToSeoConfig, type CourseSeoKind, type CourseSeoSource } from './course-seo-config';
import { routeUrlToSeoSlug } from './seo-route-slug';

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
 * What it does:
 * 1. **Sync early-paint** — Synchronously applies a URL-derived minimum
 *    `setSeo()` so even if SSR serializes before any async work resolves,
 *    the served HTML has full OG/Twitter coverage instead of `index.html`'s
 *    brand defaults.
 * 2. **Slug-driven Supabase lookup** — Fires `loadFromSupabase(slug, fallback)`
 *    the moment the slug is known, *without* waiting for `courseDetails()`.
 *    This is critical: a slow or errored course backend used to leave the
 *    SSR gate held until the SSR engine's own timeout; now Supabase ships
 *    its result inside the 4.5s server-side timeout regardless of the
 *    course HTTP state.
 * 3. **Course-driven fallback upgrade** — When `courseDetails()` lands, the
 *    same effect re-fires with a richer fallback (instructor, real
 *    description, trailer). The Supabase row, if any, still wins; only the
 *    no-row fallback path benefits.
 * 4. **SSR gate** — Held server-side via `PendingTasks.add()`. Released
 *    when the first Supabase call resolves (success, no-row, timeout, or
 *    abort) so SSR never blocks past `loadFromSupabase`'s own bounded wait.
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

  // SSR gate — server-only. Bounded by `loadFromSupabase`'s own withTimeout
  // (4.5s on server) so no Zone-tracked task pushes SSR past its budget.
  const releaseSeoGate: () => void = isServer ? pendingTasks.add() : () => undefined;
  let seoGateReleased = false;
  const releaseSeoGateOnce = () => {
    if (seoGateReleased) return;
    seoGateReleased = true;
    releaseSeoGate();
  };

  // Build the URL-derived fallback once. Used (a) for the sync early-paint
  // below and (b) as the backup config for the first Supabase load before
  // `courseDetails` arrives — which on a slow/erroring backend may be never.
  const titleFromUrl = courseTitleFromSlug(courseTitle()) ?? brandName;
  const description = `${verb} "${titleFromUrl}" on ${brandName} — AI-driven CPE for accounting professionals.`;
  const urlDerivedFallback: SeoConfig = {
    title: titleFromUrl,
    description,
    image: SEO_BRAND_DEFAULTS.fallbackImage,
    openGraph: {
      title: titleFromUrl,
      description,
      type: SEO_BRAND_DEFAULTS.ogType,
      site_name: brandName,
    },
    twitter: {
      card: SEO_BRAND_DEFAULTS.twitterCard,
      title: titleFromUrl,
      description,
      site: SEO_BRAND_DEFAULTS.twitterSite,
      creator: SEO_BRAND_DEFAULTS.twitterCreator,
    },
  };

  // Sync early-paint so the DOM has full OG/Twitter coverage before any
  // async work — the floor below the floor.
  seoManager.setSeo(urlDerivedFallback);

  // Re-derive the SEO slug whenever the URL changes. Lifting the observable
  // into a signal makes the effect below track it — a `let`-captured closure
  // value would not be tracked, leading to stale-slug races on route reuse.
  const currentSlug = toSignal(
    router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => routeUrlToSeoSlug(e.urlAfterRedirects)),
    ),
    { initialValue: routeUrlToSeoSlug(router.url) },
  );

  // Single effect drives both the slug-change reload AND the
  // course-fallback-upgrade. The dedup key includes both the slug and
  // whether `courseDetails` is loaded so we fire:
  //   1. Once per slug, immediately, with `urlDerivedFallback`. The Supabase
  //      row (if any) wins; otherwise the URL-derived config is applied.
  //   2. Again when `courseDetails` lands, with the richer course-derived
  //      fallback. The Supabase row still wins (idempotent); only the
  //      no-row path benefits from the upgrade. `SeoManager` aborts the
  //      previous in-flight call so we don't race.
  let lastSeoKey: string | null = null;
  effect(() => {
    const slug = currentSlug();
    if (!slug) return;
    const course = courseDetails();
    const key = `${slug}|${course ? `c-${course.id}` : 'url'}`;
    if (key === lastSeoKey) return;
    lastSeoKey = key;

    const fallback: SeoConfig = course ? courseToSeoConfig(course, kind) : urlDerivedFallback;
    seoManager.loadFromSupabase(slug, fallback).finally(() => releaseSeoGateOnce());
  });

  // Clear any meta tags this page wrote so the next route doesn't inherit
  // stale OG/Twitter values from the previous course.
  destroyRef.onDestroy(() => seoManager.reset());
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

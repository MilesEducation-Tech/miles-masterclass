import { SUPPORTED_COUNTRIES } from '@core/constants/countries';
import {
  CANONICAL_COUNTRY,
  CANONICAL_LOCALE_PREFIX,
  CANONICAL_PROFESSION,
  DYNAMIC_SLUG_PREFIXES,
  PER_COUNTRY_SLUGS,
} from '@core/models/seo.constants';
import type { SeoAlternate } from '@core/models/seo.models';
import { toCountry } from '@core/utils/country';

/**
 * Top-level URL areas that live OUTSIDE the `/<country>/<profession>` locale
 * chain and own their own path verbatim (no locale normalization). Mirrors the
 * special-cases in `routeUrlToSeoSlug`, plus `blog` whose leaf pages set their
 * own absolute canonical.
 */
const NON_LOCALE_ROOTS = new Set(['auth', 'page-not-found', 'compliance', 'blog']);

/**
 * Convert a router URL into the slug used to look up an SEO row.
 *
 * Rules:
 * - Strip any query string.
 * - Empty path → 'home'.
 * - Top-level prefixes that own their own SEO outside the locale chain
 *   (`auth`, `page-not-found`, `compliance`) are returned verbatim/joined.
 *   `compliance` is a root route; without this it fell through to `home` and
 *   took the home page's row and canonical.
 * - Anything else assumes a `/<country>/<profession>/...` locale prefix and
 *   strips the first two segments (e.g. `/in/student/library/course-library`
 *   → `library/course-library`).
 *
 * The `App` and per-course components both call this — keeping it in one
 * place avoids the drift that crept into the duplicated implementations.
 */
export function routeUrlToSeoSlug(url: string): string {
  const path = url.split('?')[0];
  const segments = path.split('/').filter((s) => s);

  if (segments.length === 0) return 'home';

  if (segments[0] === 'auth') return segments.join('/');

  if (segments[0] === 'page-not-found' || segments[0] === 'compliance') {
    return segments[0];
  }

  // Locale-prefixed path: /<country>/<profession>/...
  if (segments.length >= 2) {
    const rest = segments.slice(2);
    return rest.length === 0 ? 'home' : rest.join('/');
  }

  return 'home';
}

/**
 * Build the absolute, self-referencing canonical URL for a router URL.
 *
 * Locale handling: because every `/<country>/<profession>` prefix serves
 * identical content, locale-prefixed routes are collapsed onto the single
 * `CANONICAL_LOCALE_PREFIX` (e.g. `/in/accounting/home` and `/us/accounting/home`
 * both canonicalize to `<origin>/us/accounting/home`). This dedupes the
 * duplicate-locale URLs the SEO audit flagged and matches the sitemap, which
 * lists only that one locale. Non-locale areas (auth/blog/page-not-found)
 * keep their path verbatim. Query strings and fragments are dropped.
 *
 * @param url    Router URL (e.g. `event.urlAfterRedirects`).
 * @param origin Public origin without trailing slash (e.g. `environment.SITE_URL`).
 */
export function routeUrlToCanonicalUrl(url: string, origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const path = url.split('?')[0].split('#')[0];
  const segments = path.split('/').filter((s) => s);

  if (segments.length === 0) {
    return `${cleanOrigin}/${CANONICAL_LOCALE_PREFIX}/home`;
  }

  if (NON_LOCALE_ROOTS.has(segments[0])) {
    return `${cleanOrigin}/${segments.join('/')}`;
  }

  // Locale-prefixed path → normalize onto the canonical locale. A per-country page keeps its
  // country, since its content differs there, and collapses only the profession.
  const slug = routeUrlToSeoSlug(path);
  const country = PER_COUNTRY_SLUGS.includes(slug) ? toCountry(segments[0]) : undefined;
  if (country) return `${cleanOrigin}/${country}/${CANONICAL_PROFESSION}/${slug}`;
  return `${cleanOrigin}/${CANONICAL_LOCALE_PREFIX}/${slug}`;
}

/**
 * The `<link rel="alternate" hreflang>` set for a router URL: one per supported country plus
 * `x-default` on the canonical locale for a per-country page (`PER_COUNTRY_SLUGS`), and empty for
 * every other page, so the canonical stays the only locale signal there.
 *
 * ponytail: `en-<CC>` for every country, since production is English-only; becomes language ×
 * country once `I18N.enabled` ships.
 */
export function routeUrlToAlternates(url: string, origin: string): SeoAlternate[] {
  const slug = routeUrlToSeoSlug(url.split('?')[0].split('#')[0]);
  if (!PER_COUNTRY_SLUGS.includes(slug)) return [];
  const cleanOrigin = origin.replace(/\/+$/, '');
  const href = (country: string) => `${cleanOrigin}/${country}/${CANONICAL_PROFESSION}/${slug}`;
  return [
    ...SUPPORTED_COUNTRIES.map((c) => ({ hreflang: `en-${c.toUpperCase()}`, href: href(c) })),
    { hreflang: 'x-default', href: href(CANONICAL_COUNTRY) },
  ];
}

/**
 * Whether the slug points at a "dynamic" page whose SEO is owned by a leaf
 * component (course detail), not the global router-driven loader.
 */
export function isDynamicSlug(slug: string): boolean {
  return DYNAMIC_SLUG_PREFIXES.some((prefix) =>
    prefix.endsWith('/')
      ? slug.startsWith(prefix)
      : slug === prefix || slug.startsWith(`${prefix}/`),
  );
}

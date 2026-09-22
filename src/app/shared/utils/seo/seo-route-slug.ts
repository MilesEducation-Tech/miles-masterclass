import { CANONICAL_LOCALE_PREFIX, DYNAMIC_SLUG_PREFIXES } from '@core/models/seo.constants';

/**
 * Top-level URL areas that live OUTSIDE the `/<country>/<profession>` locale
 * chain and own their own path verbatim (no locale normalization). Mirrors the
 * special-cases in `routeUrlToSeoSlug`, plus `blog` whose leaf pages set their
 * own absolute canonical.
 */
const NON_LOCALE_ROOTS = new Set(['auth', 'admin', 'page-not-found', 'blog']);

/**
 * Convert a router URL into the slug used to look up an SEO row.
 *
 * Rules:
 * - Strip any query string.
 * - Empty path → 'home'.
 * - Top-level prefixes that own their own SEO outside the locale chain
 *   (`auth`, `admin`, `page-not-found`) are returned verbatim/joined.
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

  if (segments[0] === 'admin' || segments[0] === 'page-not-found') {
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
 * lists only that one locale. Non-locale areas (auth/admin/blog/page-not-found)
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

  // Locale-prefixed path → normalize onto the canonical locale.
  const slug = routeUrlToSeoSlug(path);
  return `${cleanOrigin}/${CANONICAL_LOCALE_PREFIX}/${slug}`;
}

/**
 * Whether the slug points at a "dynamic" page whose SEO is owned by a leaf
 * component (course detail, admin), not the global router-driven loader.
 */
export function isDynamicSlug(slug: string): boolean {
  return DYNAMIC_SLUG_PREFIXES.some((prefix) =>
    prefix.endsWith('/')
      ? slug.startsWith(prefix)
      : slug === prefix || slug.startsWith(`${prefix}/`),
  );
}

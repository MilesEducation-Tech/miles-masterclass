export type SeoPageType = 'static' | 'dynamic';

/**
 * Canonical locale prefix. The app serves byte-identical content under every
 * `/<country>/<profession>` prefix, so we pick exactly ONE locale as canonical
 * and collapse every duplicate-locale URL onto it (see
 * `routeUrlToCanonicalUrl`). MUST stay in sync with the sitemap's `PREFIX`
 * (src/seo.ts), which lists only this same locale — otherwise canonical tags
 * and sitemap URLs would disagree and Google would see conflicting signals.
 */
export const CANONICAL_COUNTRY = 'us';
export const CANONICAL_PROFESSION = 'accounting';
export const CANONICAL_LOCALE_PREFIX = `${CANONICAL_COUNTRY}/${CANONICAL_PROFESSION}`;

/**
 * Slugs whose content differs per country (prices), so each country's URL is its own canonical
 * and the page lists every supported country as an `hreflang` alternate, `x-default` on the
 * canonical locale. Every other slug collapses onto `CANONICAL_LOCALE_PREFIX`. The sitemap
 * (`src/seo.ts`) still lists only the `/us/` URL; the alternates on the page cover the rest.
 */
export const PER_COUNTRY_SLUGS: readonly string[] = ['payment/plan'];

/**
 * Brand-level defaults for the SEO fallbacks (course, webinar and structured
 * data). Keeping them here means a single edit propagates to every place
 * these strings appear.
 */
export const SEO_BRAND_DEFAULTS = {
  publisher: 'Miles Masterclass',
  ogSiteName: 'Miles Masterclass',
  ogLocale: 'en_US',
  twitterSite: '@MilesEducation',
  twitterCreator: '@MilesEducation',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  robots: 'index, follow',
  // S3 path is `static-assests` (sic) — it's the real bucket path, not a typo.
  // Don't "fix" the spelling without coordinating with the static-assets owner.
  fallbackImage: 'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/index.webp',
} as const;

/**
 * Per-course-kind brand names used in the constructor-level fallback SEO
 * (og:site_name, page title) for dynamic course detail pages. Masterclass
 * matches `SEO_BRAND_DEFAULTS.publisher`; podcast and micro-learning carry
 * their own brand strings.
 */
export const COURSE_BRAND_NAMES = {
  masterclass: SEO_BRAND_DEFAULTS.publisher,
  podcast: 'Miles Podcast',
  microLearning: 'Miles Micro-Learning',
  aiLab: 'Miles AI Labs',
} as const;

/**
 * Per-course-kind verbs used in the URL-derived fallback `description`
 * meta tag (e.g. `Watch "X" on Miles Masterclass...` vs
 * `Listen to "X" on Miles Podcast...`).
 */
export const COURSE_DESCRIPTION_VERBS = {
  masterclass: 'Watch',
  podcast: 'Listen to',
  microLearning: 'Watch',
  aiLab: 'Watch',
} as const;

/**
 * URL-segment prefixes whose SEO is owned by the leaf component (course
 * detail pages) rather than the global router-driven
 * `App` SEO load. Drives the skip list in `App.getRouteSlug` so adding a new
 * dynamic feature is a one-line edit.
 */
export const DYNAMIC_SLUG_PREFIXES: readonly string[] = [
  'masterclass/',
  'podcast/',
  'micro-learning/',
  'ai-labs/',
  // `webinar/:id` and `webinar/:id/…`. The detail page sets its own `Event`
  // structured data from the row (see `webinar/utils/webinar-seo.ts`); the bare
  // `webinar` landing page is NOT covered by this prefix and keeps its
  // Supabase-managed row.
  'webinar/',
] as const;

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

export interface SeoDefaultPageDef {
  slug: string;
  name: string;
  type: SeoPageType;
}

/**
 * Brand-level defaults baked into seeded pages and used as fallbacks across
 * the editor and `seoPageToConfig`. Keeping them here means a single edit
 * propagates to every place these strings appear.
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
 * detail pages, admin tooling, etc.) rather than the global router-driven
 * `App` SEO load. Drives the skip list in `App.getRouteSlug` so adding a new
 * dynamic feature is a one-line edit.
 */
export const DYNAMIC_SLUG_PREFIXES: readonly string[] = [
  'masterclass/',
  'podcast/',
  'micro-learning/',
  'ai-labs/',
  'admin',
] as const;

/**
 * Default pages to seed into Supabase if the table is empty. Dynamic course
 * pages are intentionally excluded — the underlying lookup is `eq('page_slug',
 * slug)` which can't match a literal `:courseId` template against a real URL
 * like `masterclass/123/intro-to-tax`. Course pages instead build a fallback
 * config from live course data and call `loadFromSupabase` so an admin can
 * override the static slug. Re-adding dynamic pattern matching would require
 * a slug-template column + LIKE query on the Supabase side.
 */
export const DEFAULT_SEO_PAGES: SeoDefaultPageDef[] = [
  { slug: 'home', name: 'Home Page', type: 'static' },
  { slug: 'masterclass', name: 'Masterclass Listing', type: 'static' },
  { slug: 'podcast', name: 'Podcast Listing', type: 'static' },
  { slug: 'webinar', name: 'Webinar Listing', type: 'static' },
  { slug: 'micro-learning', name: 'Micro Learning Listing', type: 'static' },
  { slug: 'faq', name: 'FAQ', type: 'static' },
  { slug: 'terms-of-service', name: 'Terms of Service', type: 'static' },
  { slug: 'privacy-policy', name: 'Privacy Policy', type: 'static' },
  { slug: 'library/ai-library', name: 'AI Library', type: 'static' },
  { slug: 'library/instructor-library', name: 'Instructor Library', type: 'static' },
  { slug: 'library/badge-library', name: 'Badge Library', type: 'static' },
  { slug: 'library/course-library', name: 'Course Library', type: 'static' },
  { slug: 'payment/plan', name: 'Payment Plans', type: 'static' },
  { slug: 'auth/login', name: 'Login', type: 'static' },
  { slug: 'auth/signup', name: 'Sign Up', type: 'static' },
];

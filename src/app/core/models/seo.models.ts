import { SEO_BRAND_DEFAULTS, SeoPageType } from './seo.constants';

/** Runtime-validated values for the `og:type` meta. */
const OG_TYPES: readonly NonNullable<OpenGraph['type']>[] = [
  'website',
  'article',
  'profile',
  'book',
  'music',
  'video',
] as const;

/** Runtime-validated values for the `twitter:card` meta. */
const TWITTER_CARDS: readonly NonNullable<TwitterCard['card']>[] = [
  'summary',
  'summary_large_image',
  'app',
  'player',
] as const;

const isOgType = (v: string): v is NonNullable<OpenGraph['type']> =>
  (OG_TYPES as readonly string[]).includes(v);

const isTwitterCard = (v: string): v is NonNullable<TwitterCard['card']> =>
  (TWITTER_CARDS as readonly string[]).includes(v);

export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface OpenGraph {
  title?: string;
  description?: string;
  image?: string;
  video?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile' | 'book' | 'music' | 'video';
  locale?: string;
  site_name?: string;
}

export interface TwitterCard {
  card?: 'summary' | 'summary_large_image' | 'app' | 'player';
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
}

export interface SeoConfig {
  title: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  language?: string;
  robots?: string;
  author?: string;
  publisher?: string;
  image?: string; // Fallback helper for easy OG image
  openGraph?: OpenGraph;
  twitter?: TwitterCard;
  jsonLd?: Record<string, unknown>; // For structured data
}

/**
 * Represents a page's SEO configuration stored in Supabase.
 */
export interface SeoPage {
  id?: string;
  page_slug: string;
  page_name: string;
  page_type: SeoPageType;
  is_active: boolean;
  /**
   * Optional URL-segment pattern used as a fallback when an exact `page_slug`
   * lookup misses (e.g. `podcast/:courseId/:courseTitle`). `:`-prefixed
   * segments match any value; literal segments must match exactly.
   * `null`/absent for static pages and concrete dynamic rows.
   */
  slug_pattern?: string | null;

  // Core SEO
  title: string;
  description: string;
  keywords: string[];
  robots: string;
  canonical_url: string;
  author: string;
  publisher: string;

  // Open Graph
  og_title: string;
  og_description: string;
  og_image: string;
  og_type: string;
  og_site_name: string;
  og_locale: string;

  // Twitter Card
  twitter_card: string;
  twitter_site: string;
  twitter_creator: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image: string;
  twitter_image_alt: string;

  // Structured Data
  json_ld: Record<string, unknown>;

  // Audit
  updated_at?: string;
  updated_by: string;
  notes: string;
}

/**
 * SEO field character limits and validation rules.
 */
export const SEO_LIMITS = {
  title: { min: 30, ideal: 60, max: 70 },
  description: { min: 70, ideal: 160, max: 170 },
  keywords: { maxCount: 15 },
  ogTitle: { max: 95 },
  ogDescription: { max: 200 },
  twitterTitle: { max: 70 },
  twitterDescription: { max: 200 },
} as const;

/**
 * Compute a simple SEO completeness score (0-100).
 */
export function computeSeoScore(page: SeoPage): number {
  let score = 0;
  const checks = [
    {
      weight: 20,
      pass: page.title.length >= SEO_LIMITS.title.min && page.title.length <= SEO_LIMITS.title.max,
    },
    {
      weight: 20,
      pass:
        page.description.length >= SEO_LIMITS.description.min &&
        page.description.length <= SEO_LIMITS.description.max,
    },
    { weight: 10, pass: page.keywords.length >= 3 },
    { weight: 10, pass: !!page.og_title },
    { weight: 10, pass: !!page.og_description },
    { weight: 10, pass: !!page.og_image },
    { weight: 10, pass: !!page.twitter_title },
    { weight: 5, pass: !!page.twitter_description },
    { weight: 5, pass: !!page.canonical_url },
  ];
  for (const check of checks) {
    if (check.pass) score += check.weight;
  }
  return score;
}

/**
 * Convert a SeoPage record into a SeoConfig for the SeoManager.
 */
export function seoPageToConfig(page: SeoPage): SeoConfig {
  return {
    title: page.title,
    description: page.description || undefined,
    keywords: page.keywords?.length ? page.keywords : undefined,
    robots: page.robots || undefined,
    canonicalUrl: page.canonical_url || undefined,
    author: page.author || undefined,
    publisher: page.publisher || undefined,
    image: page.og_image || undefined,
    openGraph: {
      title: page.og_title || undefined,
      description: page.og_description || undefined,
      image: page.og_image || undefined,
      type: page.og_type && isOgType(page.og_type) ? page.og_type : 'website',
      site_name: page.og_site_name || undefined,
      locale: page.og_locale || undefined,
    },
    twitter: {
      card:
        page.twitter_card && isTwitterCard(page.twitter_card)
          ? page.twitter_card
          : 'summary_large_image',
      site: page.twitter_site || undefined,
      creator: page.twitter_creator || undefined,
      title: page.twitter_title || undefined,
      description: page.twitter_description || undefined,
      image: page.twitter_image || undefined,
      imageAlt: page.twitter_image_alt || undefined,
    },
    jsonLd: page.json_ld && Object.keys(page.json_ld).length > 0 ? page.json_ld : undefined,
  };
}

/**
 * Create a blank SeoPage with defaults.
 */
export function createDefaultSeoPage(
  slug: string,
  name: string,
  type: SeoPageType = 'static',
): SeoPage {
  return {
    page_slug: slug,
    page_name: name,
    page_type: type,
    is_active: true,
    slug_pattern: null,
    title: '',
    description: '',
    keywords: [],
    robots: SEO_BRAND_DEFAULTS.robots,
    canonical_url: '',
    author: '',
    publisher: SEO_BRAND_DEFAULTS.publisher,
    og_title: '',
    og_description: '',
    og_image: '',
    og_type: SEO_BRAND_DEFAULTS.ogType,
    og_site_name: SEO_BRAND_DEFAULTS.ogSiteName,
    og_locale: SEO_BRAND_DEFAULTS.ogLocale,
    twitter_card: SEO_BRAND_DEFAULTS.twitterCard,
    twitter_site: SEO_BRAND_DEFAULTS.twitterSite,
    twitter_creator: SEO_BRAND_DEFAULTS.twitterCreator,
    twitter_title: '',
    twitter_description: '',
    twitter_image: '',
    twitter_image_alt: '',
    json_ld: {},
    updated_by: 'system',
    notes: '',
  };
}

import { SEO_BRAND_DEFAULTS } from '../../core/models/seo.constants';

/**
 * Site-wide JSON-LD structured data (schema.org) emitted on every static page
 * via the global SEO config (see app.ts → SeoManager.setJsonLd). Before this,
 * the SSR HTML carried zero structured data (audit: Schema 0/100), so Google
 * could surface no Organization knowledge panel / educational-credential
 * signals for an NASBA-accredited CPE provider.
 *
 * The graph declares two linked nodes:
 *   - An `Organization` + `EducationalOrganization` (the publisher/provider),
 *     with `sameAs` social profiles and the NASBA sponsor note.
 *   - A `WebSite` that points back at the organization as its publisher.
 *
 * `@id`s are anchored to the origin so course-level `Course` schema (added per
 * course page) can reference `{origin}/#organization` as its `provider`.
 *
 * @param origin Public origin without trailing slash (e.g. `environment.SITE_URL`).
 */
export function buildSiteStructuredData(origin: string): Record<string, unknown> {
  const base = origin.replace(/\/+$/, '');
  const organizationId = `${base}/#organization`;
  const websiteId = `${base}/#website`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Organization', 'EducationalOrganization'],
        '@id': organizationId,
        name: SEO_BRAND_DEFAULTS.ogSiteName,
        legalName: 'Miles Masterclass Inc.',
        url: base,
        logo: {
          '@type': 'ImageObject',
          url: SEO_BRAND_DEFAULTS.fallbackImage,
        },
        description:
          "Finally, CPE that's all about AI in Accounting. AI-powered CPE training — " +
          'Master Classes, Podcasts, Reels & Live Premieres for accounting professionals.',
        slogan: 'AI-Powered CPE Training for Accounting Professionals',
        // NASBA National Registry of CPE Sponsors — Sponsor ID 149174 (see footer).
        identifier: {
          '@type': 'PropertyValue',
          name: 'NASBA Sponsor ID',
          value: '149174',
        },
        sameAs: [
          'https://www.linkedin.com/company/miles-masterclass',
          'https://www.youtube.com/@MilesMasterclass',
          'https://www.instagram.com/miles.masterclass/',
          'https://apps.apple.com/in/app/miles-masterclass-ai-cpe/id6736642042',
          'https://play.google.com/store/apps/details?id=com.miles.masterclass',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: base,
        name: SEO_BRAND_DEFAULTS.ogSiteName,
        inLanguage: 'en-US',
        publisher: { '@id': organizationId },
      },
    ],
  };
}

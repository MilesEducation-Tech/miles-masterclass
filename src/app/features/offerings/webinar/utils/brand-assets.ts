/**
 * Brand marks the webinar surfaces render as images rather than text.
 *
 * These live on the same CloudFront bucket the rest of the site's static art
 * comes from, and are referenced by absolute URL for the same reason: they are
 * shared with the marketing site and the mobile app, so a copy in `public/`
 * would be a second thing to keep in step.
 *
 * `caira` is the wordmark WITH its "Certified AI-Ready Accountant" lockup
 * baked in, white on transparent at 2616×838 (≈3.12:1). Size it by height and
 * let the width follow; it is invisible on a light surface.
 */
export const BRAND_MARKS = {
  caira:
    'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/caira-logo-white.webp',
  credly: 'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/credly.webp',
} as const;

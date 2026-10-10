import { environment } from '@env/environment';

/**
 * Home page artwork on the shared asset bucket: the Figma exports (pricing
 * icon, phone render, webinar banner) uploaded to `static-assests/web-app/home-v3/`,
 * the same bucket every partner page reads from. Nothing is bundled with the app.
 */
const HOME_ASSET_BASE = `${environment.S3_BUCKET_URL}static-assests/web-app/home-v3/`;

/**
 * The hero grid's course thumbnails: q60 / 480px copies of the first three
 * tracks' artwork, listed in `hero-grid-columns.ts`, under this prefix.
 */
export const HOME_HERO_GRID_BASE = `${HOME_ASSET_BASE}home-hero-grid/`;

export const HOME_ASSETS = {
  webinarBanner: `${HOME_ASSET_BASE}webinar-banner.webp`,
  pricingAppIcon: `${HOME_ASSET_BASE}pricing-app-icon.webp`,
  appPhoneInHand: `${HOME_ASSET_BASE}app-phone-in-hand.webp`,
  /** The white CAIRA wordmark with tagline the rest of the app already ships (2616×838). */
  cairaLogo: `${environment.S3_BUCKET_URL}static-assests/web-app/commons/caira-logo-white.webp`,
} as const;

/**
 * Maps a frontend URL to the API course-type token used by `FeatureFacade`
 * and the various offering features.
 *
 * The URL segment uses kebab-case (`/micro-learning`) while the API token
 * uses snake_case (`nano_learning`) per AGENT.md §6. Centralising the
 * mapping here keeps the magic strings out of orchestrators and ensures a
 * new offering can be added in one place.
 *
 * Returns an empty string when the URL doesn't match any known offering —
 * downstream consumers (e.g. `FeatureFacade.refreshPersonalized`) treat that
 * as a no-op.
 */
export const OFFERING_URL_SEGMENTS = {
  masterclass: '/masterclass',
  podcast: '/podcast',
  microLearning: '/micro-learning',
} as const;

export const OFFERING_TYPE_TOKENS = {
  masterclass: 'masterclass',
  podcast: 'podcast',
  microLearning: 'nano_learning',
} as const;

export type OfferingTypeToken = (typeof OFFERING_TYPE_TOKENS)[keyof typeof OFFERING_TYPE_TOKENS];

export function offeringTypeFromUrl(url: string): OfferingTypeToken | '' {
  if (url.includes(OFFERING_URL_SEGMENTS.masterclass)) return OFFERING_TYPE_TOKENS.masterclass;
  if (url.includes(OFFERING_URL_SEGMENTS.podcast)) return OFFERING_TYPE_TOKENS.podcast;
  if (url.includes(OFFERING_URL_SEGMENTS.microLearning)) return OFFERING_TYPE_TOKENS.microLearning;
  return '';
}

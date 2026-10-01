/**
 * Countries the app has its own URL scope for (`/:country/:profession_type/...`), as lower-case
 * ISO 3166-1 alpha-2 — the same codes Vercel sends in `x-vercel-ip-country`, lower-cased.
 *
 * This is the ONLY list. The route guard, the server-side `/` and legacy redirects and the API
 * country all validate against it through `toCountry()` (`core/utils/country.ts`), so a country the
 * server redirects to can never be rejected by the guard on arrival. Anything not listed resolves
 * to `DEFAULT_COUNTRY`.
 *
 * Which plan a country gets is Django's call, not this file's: every European country has its own
 * URL here and Django groups them onto plans. Adding a country is one line here; nothing else in
 * the frontend changes.
 */
export const SUPPORTED_COUNTRIES = [
  'us',
  'in',
  'ae',
  'ca',
  'au',
  // Europe: the UN M49 "Europe" region, plus Cyprus (an EU member that M49 files under Asia).
  // Eastern
  'by',
  'bg',
  'cz',
  'hu',
  'pl',
  'md',
  'ro',
  'ru',
  'sk',
  'ua',
  // Northern
  'ax',
  'dk',
  'ee',
  'fo',
  'fi',
  'gg',
  'is',
  'ie',
  'im',
  'je',
  'lv',
  'lt',
  'no',
  'sj',
  'se',
  'gb',
  // Southern
  'al',
  'ad',
  'ba',
  'hr',
  'gi',
  'gr',
  'va',
  'it',
  'mt',
  'me',
  'mk',
  'pt',
  'sm',
  'rs',
  'si',
  'es',
  'cy',
  // Western
  'at',
  'be',
  'fr',
  'de',
  'li',
  'lu',
  'mc',
  'nl',
  'ch',
] as const;

/** Where every unknown, unsupported or undetectable visitor lands. */
export const DEFAULT_COUNTRY = 'us';

/**
 * Cookie carrying the server's geo answer to the browser, so client-rendered routes and in-app
 * navigations resolve the same country the server did. Written ONLY by the Express middleware in
 * `src/geo-country.ts`, never by app code. Deliberately not the old `country` cookie, which held
 * timezone guesses and is now ignored.
 */
export const GEO_COUNTRY_COOKIE = 'geo_country';

/** Vercel's edge geo header. Vercel sets it on every request; absent locally. */
export const GEO_COUNTRY_HEADER = 'x-vercel-ip-country';

import { SUPPORTED_COUNTRIES } from '../constants/countries';
import { PROFESSIONS } from '../constants/profession';
import type { CountryCode } from '../models/route-params.model';

const SUPPORTED: ReadonlySet<string> = new Set(SUPPORTED_COUNTRIES);

/**
 * Normalise any country input — a URL segment, the geo header, a cookie — to a supported
 * `CountryCode`, or `undefined` when it isn't one. Vercel sends `XX` / `T1` for IPs it can't place,
 * so those fall out here too. The single validator for the whole app (Angular and Express); callers
 * pick their own fallback.
 */
export function toCountry(value: string | null | undefined): CountryCode | undefined {
  const code = value?.trim().toLowerCase();
  return code && SUPPORTED.has(code) ? (code as CountryCode) : undefined;
}

/**
 * The supported country a URL is scoped to, or `undefined` when the URL is outside the
 * `/:country/:profession_type` tree (`/`, `/auth/login`, `/compliance`) or names an unsupported
 * country. The second segment must be a real profession, otherwise `/auth/login` would read as
 * country `auth`.
 */
export function countryFromUrl(url: string): CountryCode | undefined {
  const [country, profession] = url.split(/[/?#]/).filter(Boolean);
  const isProfession = PROFESSIONS.some((p) => p.toLowerCase() === profession?.toLowerCase());
  return isProfession ? toCountry(country) : undefined;
}

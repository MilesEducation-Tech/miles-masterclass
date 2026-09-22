import { CountryCode, ProfessionType } from '@core/models/route-params.model';

/**
 * Composite key for locale-keyed content overrides. Lowercased on lookup so
 * authors don't have to worry about case (`'US:Accounting'` and
 * `'us:accounting'` match the same bucket).
 */
export type LocaleKey = `${string}:${string}`;

/**
 * Resolve locale-specific content with a default fallback. Used by legal-doc
 * and FAQ constants to support per-country/profession variations without
 * forcing each page to know about every locale.
 *
 * @example
 *   const OVERRIDES: Partial<Record<LocaleKey, FAQ[]>> = {
 *     'in:accounting': IN_ACCOUNTING_FAQS,
 *   };
 *   export const resolveFaqData = (c: CountryCode, p: ProfessionType) =>
 *     resolveByLocale(OVERRIDES, DEFAULT_FAQS, c, p);
 */
export function resolveByLocale<T>(
  overrides: Partial<Record<LocaleKey, T>>,
  defaultValue: T,
  country: CountryCode,
  profession: ProfessionType,
): T {
  const key = `${country.toLowerCase()}:${String(profession).toLowerCase()}` as LocaleKey;
  return overrides[key] ?? defaultValue;
}

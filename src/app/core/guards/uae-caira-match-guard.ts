import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

/**
 * Country segments (ISO2, lower-cased) that should see the UAE CAIRA marketing
 * landing page at `/<country>/accounting/home` instead of the default `Home`.
 *
 * NOTE: `validateProfessionCountryGuard` only admits the ISO2 codes in
 * `SUPPORTED_COUNTRIES` (`core/constants/countries.ts`), where the UAE is `ae`,
 * so the canonical URL is `/ae/accounting/home`. A `uae` vanity URL would need a
 * `/uae → /ae` redirect, not a new entry here.
 */
const UAE_CAIRA_COUNTRIES = ['ae'];
const UAE_CAIRA_PROFESSION = 'accounting';

/**
 * Decides whether the UAE CAIRA landing page should handle `home` for the
 * current URL. `country` / `profession_type` are matched by the *parent*
 * `:country/:profession_type` route, so they aren't in the `segments` handed to
 * this `CanMatch` (those are just `['home']`). We therefore read them off the
 * navigation's URL tree.
 *
 * Used to gate the first of two `home` route definitions in `features.ts`:
 * when this returns `false`, routing falls through to the existing `Home`.
 */
export const uaeCairaMatchGuard: CanMatchFn = () => {
  const router = inject(Router);

  const nav = router.getCurrentNavigation();
  // During matching `finalUrl` may not be resolved yet; fall back to the URL
  // being processed (`extractedUrl`) and finally the current router URL.
  const tree = nav?.finalUrl ?? nav?.extractedUrl ?? router.parseUrl(router.url);

  const segments = tree.root.children['primary']?.segments.map((s) => s.path) ?? [];
  const [country, profession] = segments;

  return (
    UAE_CAIRA_COUNTRIES.includes((country ?? '').toLowerCase()) &&
    (profession ?? '').toLowerCase() === UAE_CAIRA_PROFESSION
  );
};

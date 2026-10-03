# Country resolution, rebuilt from scratch

Status: plan approved 2026-10-01. Ticket 1 is implemented and uncommitted. Ticket 2 is blocked on the backend.

## Context

Plans and prices will differ per country, and Django will read the country from a request header. The old
detection wasn't fit for a payment path:

- **The browser guessed the country from the timezone.** `LocationService` read `Intl…timeZone` and wrote the
  guess into a 365-day `country` cookie, which the server then trusted _above_ the IP header. It used exact
  zone-name matching, which fails on aliases such as `Asia/Calcutta` and silently falls back to `us`.
- **The server and the browser could disagree.** The header logo (`routerLink="/"`) ran `rootRedirectGuard` in the
  browser, which used the timezone.
- **There were two detectors.** `legacy-redirects.ts` read the IP header only, while `LocationService` read the
  cookie, then the IP header, then the timezone.
- **Every ISO country was valid in the URL.** All 250 codes were accepted, validated against the 93 KB
  `timezone.ts`. An invalid country dropped the deep link and redirected to `/us/accounting`.
- **`Utils._country` defaulted to `'us'`.** A visitor landing directly on `/auth/login` got `/us/...` links.

**Decision: timezone is not a country signal and is removed entirely.** The URL is the source of truth. When the
URL has no country, or an unsupported one, the edge IP (`x-vercel-ip-country`) decides, then `us`.

Settled with the user:

- Supported countries are `us`, `in`, `ae`, `ca`, `au` and the whole of Europe, each with its own URL.
- Django groups countries onto plans.
- The country reaches Django in a header that the interceptor sends on every request.
- SEO and performance must not regress.
- Language is a later ticket.

## Design

```
                       ┌─ URL has a supported country ─► that country      (always wins; never overridden)
CountryContext.current ┤
                       └─ otherwise ─► detect(): server = x-vercel-ip-country header
                                                 browser = geo_country cookie (set by Express from the same header)
                                                 └─ unsupported / XX / T1 / missing ─► 'us'
```

**Shared constants and validator**

- `core/constants/countries.ts`:
  - `SUPPORTED_COUNTRIES`: Europe is UN M49 "Europe" plus `cy`.
  - `DEFAULT_COUNTRY`
  - `GEO_COUNTRY_COOKIE`
  - `GEO_COUNTRY_HEADER`
- `CountryCode` is now the literal union of the supported countries.
- `core/utils/country.ts`:
  - `toCountry()` is the only validator, used by both Angular and Express.
  - `countryFromUrl()` reads the country from a URL.

**`CountryContext` (`core/services/country-context/`)**

- Replaces `LocationService`.
- It is seeded from `PlatformLocation`, which holds the same URL on the server and in the browser, or else from
  `detect()`.
- It updates on `ResolveStart`, which fires after guards and before components are created.
- `Utils.country` delegates to it.

**Express (`src/geo-country.ts`)**

- `geoRootRedirect`: `GET /` returns a 302 to `/<cc>/accounting/home`.
  - It answers in a single hop and is sent with `private, no-store`.
  - The query string is kept.
  - Angular doesn't render for this request.
- `geoCountryCookie`: sets `geo_country` on HTML responses only, and only when the value changes.

**Guards**

- `rootRedirectGuard` only handles in-app navigations to `/` and uses `current()`.
- `validateProfessionCountryGuard`:
  - lower-cases a supported country written in upper case;
  - swaps only an unsupported country, keeping the path, query string and fragment;
  - sends an unknown profession to `/<cc>/accounting`.

**`legacy-redirects.ts`**

- Uses `toCountry`.
- Status codes are unchanged.
- A target whose country came from geo gets `Cache-Control: private, max-age=86400`.

**Deleted**

- `core/services/location/location.ts`
- `core/constants/timezone.ts`
- `core/constants/country.ts`
- the `location.ts` entry in `LEGACY_ANY_FILES`

### Payment safety (backend requirements)

1. **The header is advisory and client-controlled.** At `proceed_checkout`, Django re-derives the country from the
   billing address (and the card country), then re-prices or rejects on a mismatch.
2. **Cart and order snapshot price and currency.** A later header change never silently re-prices a cart.
3. **Before Ticket 2 merges:**
   - `X-Country-Code` is in `Access-Control-Allow-Headers` on every environment.
   - Preflights return `Access-Control-Max-Age: 7200`.
   - Cacheable plan or price responses send `Vary: X-Country-Code`.
4. **A missing or unsupported header defaults to US** on Django.

## Tickets

### Ticket 1: country resolution (implemented)

**Summary:** `feat(core): resolve the country from the URL and edge IP and drop timezone detection`
**Issue type:** Story · **Component / scope:** core
**Branch:** `feat/MIL-<n>-country-resolution`
**Links:** blocks Ticket 2

**Current behaviour:** see Context above.

**Expected behaviour:**

- The URL decides when it holds a supported country. Otherwise the edge IP decides, then `us`.
- There is one list and one validator.
- The server and the browser agree.
- Deep links survive an invalid country.

**Scope:**

- In: everything under Design.
- Out:
  - the API header (Ticket 2)
  - language
  - a country switcher
  - the payment `'USD'` fallbacks
  - per-country canonical and hreflang

**Acceptance criteria:**

- [x] No code reads the timezone to decide the country, and the old files are deleted.
- [x] `/` returns a 302 to `/<geo>/accounting/home` in one hop, or `/us/...` for a missing, `XX` or unsupported country.
- [x] `/zz/accounting/library?a=1` redirects to `/<current>/accounting/library?a=1`.
- [x] `/IN/accounting` redirects to `/in/...`.
- [x] A valid URL country is never changed by geo (`/de/...` with IN geo stays on `/de/...`).
- [x] `geo_country` is set on HTML responses only, and only when the value changes.
- [x] Legacy redirect status codes are unchanged, and geo-filled ones carry `private, max-age=86400`.
- [x] SEO output (title, OG, Twitter, canonical, robots, sitemap) is byte-identical to `master`.
- [x] The initial bundle is smaller than on `master`.
- [x] Specs cover `toCountry`, `countryFromUrl`, `CountryContext`, both guards, both middlewares and legacy redirects.

**Risks:**

- Links to unsupported countries now redirect. The canonical already collapsed them to `/us`, so no indexed URL is lost.
- The Europe list includes RU and BY, which needs a business and legal sanctions check.

**Estimate:** M

### Ticket 2: send the country to the API (blocked on backend)

**Summary:** `feat(core): send X-Country-Code on every API request`
**Branch:** `feat/MIL-<n>-country-api-header`

**What it does:**

- `appInterceptor` sets `X-Country-Code: <UPPER ISO2>` from `CountryContext.current()` on every non-external request.
- The retired-header comment and its spec are rewritten.
- `PaymentFacade` plan requests read `country()` so they re-fetch when the country changes.

**The PR description starts with:** `⚠️ Needs UAT sign-off — do not merge` until the backend CORS change is live
everywhere.

**Estimate:** S

### Ticket 3 (optional): remove the dead 25 MB `core/constants/location.ts`

**Summary:** `chore(core): delete the unused 25 MB location constant`
**Branch:** `chore/MIL-<n>-remove-dead-location-data`

### Later

- **Language:** an `Accept-Language` header from the same interceptor, plus `<html lang>` and `dir`.
- **Country switcher:** a `preferred_country` cookie that ranks above geo. Never reuse the name `country`.
- **Hard-coded `'USD'`:** in coupons and the price overview.
- **Per-country hreflang and self-canonical** URLs for plan pages.

## Implementation notes (2026-10-01)

- Both guards are tested in one spec, `validate-profession-country-guard.spec.ts`.
- **The root redirect targets `/home` directly.** The first build probe showed `/` → `/in/accounting` →
  `/in/accounting/home`, one hop more than `master`, so Express now redirects straight to the final URL.
- **`/` now keeps its query string.** `master` dropped UTMs on the bare domain. This is a behaviour change.
- **Measured against a `master` build of the same commit, using the production bundles:**
  - initial bundle: 1.08 MB / 241.28 kB transfer on `master`, 1.02 MB / 235.24 kB on the branch;
  - SEO output: 59 lines, identical.

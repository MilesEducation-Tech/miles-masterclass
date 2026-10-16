# Country switcher, preference cookie, mismatch banner and per-country plan SEO

Status: approved and implemented 2026-10-16 (uncommitted; gates green, verified on dev 3000/4101). The "Later" section of `prompts/country-resolution.md` names
this work.

## Goal

A learner can browse any supported country freely (nothing redirects on IP), but the market they are in is
explicit and recoverable:

- a `preferred_country` cookie, written only by an explicit choice, outranks the edge's geo answer;
- a footer country switcher next to the language switcher;
- a one-time banner when the URL country differs from where the visitor appears to be;
- the plan page says which country and currency it is pricing for;
- checkout handles the backend's `country_mismatch` refusal;
- the plan page is self-canonical per country with hreflang alternates, since its content (prices) differs
  per country; every other route keeps the collapsed `/us/` canonical.

## What it read

`prompts/country-resolution.md`; `core/services/country-context/country-context.ts`; `core/constants/countries.ts`;
`core/utils/country.ts`; `src/geo-country.ts`; `core/services/storage/storage.ts` (+ `CookieOptions`);
`core/guards/validate-profession-country-guard.ts`, `root-redirect-guard.ts`; `layout/footer/*`;
`layout/components/language-switcher/*` (+ its story); `core/services/language-context/language-context.ts`;
`core/constants/languages.ts`; `shared/ui/native-select/native-select.ts`; `layout/main-layout/*`;
`layout/header/header.html` (fixed, ~68–76 px tall); `shared/components/consent-banner/*` (the fixed,
client-only banner pattern); `features/payment/pages/plan/*`; `features/payment/services/payment-facade.ts`
(`commerceErrorOf`, `checkout`, the plans resource); `features/payment/pages/invoice/invoice.ts` (the only
`checkout()` caller); `core/services/cart/cart-store.ts`; `features/payment/models/commerce.model.ts`
(`PlanPrice.currency`); `core/models/seo.constants.ts`, `seo.models.ts`; `core/services/seo/seo-manager.ts`;
`shared/utils/seo/seo-route-slug.ts`; `src/app/app.ts` (the global SEO load); `app.routes.server.ts`
(`payment/plan` is `RenderMode.Server`); `src/seo.ts` (sitemap `PREFIX`, unchanged); `src/i18n/*.json`.

## Locked decisions

1. **One new cookie, `preferred_country`.** Written ONLY by `CountryContext.prefer()`. Never the old `country`
   name. One year, `Path=/`, `SameSite=Lax`, `Secure`, not `HttpOnly` (the browser reads it). It holds a
   validated country code, nothing personal.
2. **Precedence becomes: URL → `preferred_country` → geo header → `geo_country` cookie → `us`.** The URL still
   always wins; the preference only decides where a URL without a country lands (`/`, `/auth/*`, `/zz/...`).
   `CountryContext.detect()` and Express `detectCountry()` rank identically, both through `toCountry()`.
3. **Switching is a router navigation, not a reload.** `CountryContext.use(country)` = `prefer(country)` + navigate
   to the same URL with segment 0 swapped (query and fragment kept, the guard's approach). Outside the country
   tree (`/compliance`) it goes to `/<country>/accounting/home`. `ResolveStart` then updates `current()`, and the
   plans and cart resources re-read because they key on it already.
4. **Display names come from `Intl.DisplayNames`**, not a hand-written 57-entry map. `countryName(code, locale)`
   in `core/utils/country.ts`, localized to `LanguageContext.current` for free. Node 24 and every supported
   browser ship it. Options are sorted by name: the grouped `SUPPORTED_COUNTRIES` order is for maintainers, not
   for scanning a 57-item list.
5. **The switcher is the language switcher's shape:** a native `<select app-select>` (ng-primitives
   `NgpNativeSelect`), `layout/components/country-switcher/`, rendered unconditionally (there is always more
   than one country). It has `id="country-switcher"` so the plan page can link to it.
6. **The banner is client-only and out of flow.** `layout/components/country-banner/`, rendered in
   `main-layout.html` right after `<app-header />` inside `@defer (on idle)` with a hidden placeholder: the
   server renders the placeholder only (no hydration mismatch, no CLS), and the banner itself is
   `fixed inset-x-0 top-20 z-999`, i.e. just under the fixed header and under its z-index. It shows when,
   at creation, there is no `preferred_country`, the edge placed the visitor (`geo()` is defined), and that
   differs from the URL country. **Switch** = `use(geo)`. **Stay** = `prefer(urlCountry)`. Both write the
   cookie, so either dismisses it for a year in this browser; there is no third close button (it would have to
   write the same cookie). Copy: "You appear to be in {geo}." · "Switch to {geo}" · "Stay in {current}".
7. **Plan page label:** "Prices for {country} in {currency}", `currency` from `plans()[0].price.currency`,
   shown only with a non-empty plan list; the link is `routerLink` + `fragment="country-switcher"` (the router
   already has `anchorScrolling: 'enabled'`), so it scrolls to the footer select with no code.
8. **`country_mismatch` at checkout** is handled in `PaymentFacade.checkout()`'s error branch: the backend's
   message is shown, `CartStore.reload()` re-reads the re-priced cart, and nothing navigates (the learner is on
   the review page, which `invoice.ts` only leaves on success). `commerceErrorOf` already surfaces every
   `data.reason`; the known reasons get documented on it, nothing structural changes.
9. **Per-country SEO is slug-driven.** `PER_COUNTRY_SLUGS = ['payment/plan']` in `seo.constants.ts`.
   `routeUrlToCanonicalUrl` keeps the URL's country for those slugs (profession still collapses to
   `accounting`); a new `routeUrlToAlternates()` returns one `hreflang="en-<CC>"` link per supported country
   plus `x-default` → `/us/`, and `[]` for every other slug. `SeoConfig.alternates` carries them;
   `SeoManager` writes and removes `<link rel="alternate" hreflang>` nodes like it does the canonical.
   On a per-country page the route's canonical wins over an admin row's `canonical_url`: one Supabase row
   cannot hold 57 canonicals. `src/seo.ts` and the sitemap stay as they are.
10. **No home market on the account** (backend decision, out of scope). No `ru`/`by` change here (backend
    decision, listed below).

### Assumptions

- "Dismiss once per browser" = the cookie. A visitor who ignores both buttons sees the banner on the next full
  page load; in-app navigation to a page in the geo country hides it (the condition reads `current()`).
- `hreflang` is `en-<CC>` for every country: production is English-only (`I18N.enabled: false`). When languages
  ship, this becomes language × country (noted as a ponytail ceiling in the code).
- The `Secure` cookie works on `http://localhost` in Chromium and Firefox (localhost is a secure context);
  `geo_country` already relies on this.
- Translations for the four non-English files are added so no key goes missing; they are short UI strings.

## Target architecture

```
CountryContext (core)
  preferred(): CountryCode | undefined   ← preferred_country cookie
  geo():       CountryCode | undefined   ← x-vercel-ip-country header, else geo_country cookie
  detect():    preferred() ?? geo() ?? 'us'
  prefer(c):   writes preferred_country (the only writer)
  use(c):      prefer(c) + navigate to the same URL under c

src/geo-country.ts detectCountry(req): preferred_country → header → geo_country → 'us'

layout/components/country-switcher  → CountryContext.use()
layout/components/country-banner    → CountryContext.use() / prefer(); @defer (on idle) in main-layout
features/payment/pages/plan         → label from plans()[0].price.currency + countryName(current())
features/payment/services/payment-facade.checkout → country_mismatch → message + CartStore.reload()
shared/utils/seo/seo-route-slug     → per-country canonical + alternates for PER_COUNTRY_SLUGS
core/services/seo/seo-manager       → <link rel="alternate" hreflang> management
```

## Endpoint map

No new endpoints. Existing ones affected:

| Call                                           | Change                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `GET api/v1/subscriptions/plans/`              | None; re-reads on a country switch (already keyed on `current()`).        |
| `GET api/v1/commerce/cart/`                    | None; reloaded after `country_mismatch`.                                  |
| `POST …/checkout` (`COMMERCE_ROUTES.checkout`) | New handled refusal: `{ message, data: { reason: 'country_mismatch' } }`. |

## Phases

### Phase 1 — `preferred_country` cookie

- `core/constants/countries.ts`: `PREFERRED_COUNTRY_COOKIE = 'preferred_country'` with a doc comment (the only
  writer, never the old `country` name).
- `CountryContext`: `preferred()`, `geo()`, `detect()` reordered, `prefer()`, `use()`.
- `src/geo-country.ts`: `detectCountry()` reads `preferred_country` first.

### Phase 2 — footer country switcher

- `core/utils/country.ts`: `countryName(code, locale)`.
- `layout/components/country-switcher/country-switcher.{ts,html,stories.ts}`.
- `layout/footer/footer.{ts,html}`: render it next to the language switcher.
- `src/i18n/*.json`: `country.label`.

### Phase 3 — mismatch banner

- `layout/components/country-banner/country-banner.{ts,html}`.
- `layout/main-layout/main-layout.{ts,html}`: `@defer (on idle)` after the header.
- `src/i18n/*.json`: `country.appearIn`, `country.switchTo`, `country.stayIn`.

### Phase 4 — plan page price-locale label

- `features/payment/pages/plan/plan.{ts,html}`.

### Phase 5 — `country_mismatch` at checkout

- `features/payment/services/payment-facade.ts`: `checkout()` error branch; `commerceErrorOf` doc.

### Phase 6 — per-country canonical and hreflang on the plan page

- `core/models/seo.constants.ts`: `PER_COUNTRY_SLUGS`.
- `core/models/seo.models.ts`: `SeoAlternate`, `SeoConfig.alternates`.
- `shared/utils/seo/seo-route-slug.ts`: `routeUrlToCanonicalUrl` per-country branch, `routeUrlToAlternates`.
- `core/services/seo/seo-manager.ts`: alternates in `setSeo`, `reset`, `applyRowConfig`.
- `src/app/app.ts`: pass `alternates`.

## Files touched

New: `layout/components/country-switcher/{country-switcher.ts,html,stories.ts}`,
`layout/components/country-banner/{country-banner.ts,html}`, `prompts/country-switcher.md`.

Changed: `core/constants/countries.ts`, `core/utils/country.ts`, `core/services/country-context/country-context.ts`,
`src/geo-country.ts`, `layout/footer/footer.{ts,html}`, `layout/main-layout/main-layout.{ts,html}`,
`features/payment/pages/plan/plan.{ts,html}`, `features/payment/services/payment-facade.ts`,
`core/models/seo.constants.ts`, `core/models/seo.models.ts`, `shared/utils/seo/seo-route-slug.ts`,
`core/services/seo/seo-manager.ts`, `src/app/app.ts`, `src/i18n/{en,ar,fr,de,es}.json`.

Untouched on purpose: `src/seo.ts`, `legacy-redirects.ts`, both guards, `app.routes.server.ts`.

### PR split (each under ~400 lines)

- **PR A — `feat(core): remember the learner's country and let them switch it`:** phases 1, 2, 3, 5
  (cookie, switcher, banner, checkout mismatch) + this prompt.
- **PR B — `feat(seo): per-country canonical and hreflang on the plan page`:** phases 4 and 6 (plan label,
  SEO). Depends on nothing in A except `countryName()`, which A adds; B branches from A.

## Security requirements

- The cookie holds a `toCountry()`-validated code only; both readers validate again on read.
- `X-Country-Code` stays advisory. Pricing at checkout is the backend's (see below); the frontend only shows
  the refusal and re-reads the cart.
- The `<select>` value is validated with `toCountry()` before use (an option can be edited in devtools).
- No `document.cookie` on the server: `Storage` parses the request header; `geo-country.ts` reads the raw
  header as it does today.

## Backend requirements (the backend owns these; nothing here depends on them except item 1)

1. `proceed_checkout` re-derives the billable country from the billing address ISO2, the Stripe card country
   and the request IP, and answers `country_mismatch` (with a learner-facing `message`) when they disagree
   with `X-Country-Code` / the cart's market. Status: open.
2. Orders snapshot price and currency; a later header change never re-prices an existing order.
3. Addresses store an ISO2 `country_code`.
4. `Vary: X-Country-Code` on plan and price responses (plans currently send `Vary: Accept, origin,
Accept-Encoding`).
5. Production CORS (`api.milescaira.com`) allows `X-Country-Code`, `X-Accept-Language`, `X-Platform`,
   `X-App-Type`; UAT still lacks `x-accept-language`.
6. A decision on `ru` and `by` (sanctions): keep, or drop from `SUPPORTED_COUNTRIES` (one line each).

## Acceptance criteria

- [ ] `document.cookie` carries `preferred_country=<cc>` only after Switch, Stay or the footer select; never from
      detection alone.
- [ ] With `preferred_country=in` and `geo_country=us`, `/` (server, 302) and an in-app `/` both land on
      `/in/accounting/home`; `/zz/accounting/library?a=1` → `/in/accounting/library?a=1`.
- [ ] The footer select lists every supported country by display name, sorted, current one selected; choosing one
      navigates to the same path under it, keeping query and fragment.
- [ ] On `/in/...` with `geo_country=us` and no preference: the banner shows under the header. Stay writes
      `preferred_country=in` and hides it; a reload shows no banner. Switch goes to `/us/...` and writes `us`.
- [ ] The banner is absent from the server HTML and never renders when geo and URL agree.
- [ ] The plan page shows "Prices for India in INR" (or whatever the plans answer), and the link scrolls to the
      footer select.
- [ ] A checkout refused with `country_mismatch` toasts the backend message, re-reads the cart and stays on the
      review page.
- [ ] Served HTML of `/in/accounting/payment/plan` carries `<link rel="canonical" href=".../in/accounting/payment/plan">`,
      one `hreflang="en-XX"` link per supported country and `hreflang="x-default"` → `/us/accounting/payment/plan`;
      `/us/accounting/payment/plan` is self-canonical. `/in/accounting/home` keeps the `/us/` canonical and no
      hreflang. Navigating plan → home → plan leaves exactly one canonical and one set of alternates.
- [ ] `sitemap.xml` is byte-identical.
- [ ] `pnpm lint` (ESLint + structure), `pnpm format`, `pnpm build:prod` green locally (macOS).

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm build:prod
```

## How to verify

Dev server on port 4101 (`pnpm start`). Locally there is no Vercel header, so set the geo cookie by hand in
devtools: `document.cookie = 'geo_country=us; path=/'`. Keep the tab in the foreground: the banner's
`@defer (on idle)` waits on `requestIdleCallback`, which a background tab never runs.

1. Open `/in/accounting/home`: banner under the header. Click **Stay**: banner gone, cookie
   `preferred_country=in`. Reload: no banner.
2. Clear `preferred_country`, reload: banner. Click **Switch**: URL is `/us/accounting/home`, cookie `us`.
3. Footer select → "Germany": URL `/de/accounting/home`, cookie `de`. On `/de/accounting/faq?faq=3` pick
   "India": `/in/accounting/faq?faq=3`.
4. `/in/accounting/payment/plan`: the label reads the plans' currency; its link scrolls to the footer select.
5. SSR (`pnpm build && pnpm serve:ssr:miles-masterclass-v3`):
   ```bash
   curl -s http://localhost:4000/in/accounting/payment/plan | grep -oE '<link rel="(canonical|alternate)"[^>]*>'
   curl -s http://localhost:4000/us/accounting/payment/plan | grep -oE '<link rel="canonical"[^>]*>'
   curl -s http://localhost:4000/in/accounting/home | grep -oE '<link rel="(canonical|alternate)"[^>]*>'
   curl -s -H 'Cookie: preferred_country=in' -o /dev/null -w '%{redirect_url}\n' http://localhost:4000/
   ```
6. 375 / 768 / 1440: banner and footer row have no horizontal scroll; the select fits the footer's legal row.

## Risks

- A Supabase `payment/plan` row with a filled `canonical_url` used to win; after this it is ignored on that
  page (decision 9). Tell the SEO admin.
- 57 `<link rel="alternate">` tags on the plan page (~5 KB of HTML). Acceptable; only that page carries them.
- `Intl.DisplayNames` output differs slightly between ICU versions ("Svalbard & Jan Mayen" vs "and"). Cosmetic.
- Until backend item 1 lands, `country_mismatch` never arrives, so that branch is verified with a stubbed 4xx.

## Branch and tickets

The worktree branch is `superman/gallant-elion-31634f`; the pre-commit branch-name check rejects that shape, so
before the first commit: `git branch -m feat/MIL-101-country-switcher` (done 2026-10-16). Ticket B needs its own number.
PR B gets its own branch off A once A is up.

### Ticket A

**Summary:** `feat(core): remember the learner's country and let them switch it`
**Issue type:** Story · **Component / scope:** core (touches layout, payment)
**Branch:** `feat/MIL-101-country-switcher`
**Links:** follows the country-resolution tickets (`prompts/country-resolution.md`) · `prompts/country-switcher.md`
· blocks Ticket B

**Context:** since 2026-10-01 the URL country wins and the edge IP decides the rest, but a learner has no way to
say which market they want, and a visitor who lands on another country's URL gets no hint. Django prices by
`X-Country-Code`, which the browser controls, so checkout must also survive the backend's refusal.

**Current behaviour:** no switcher, no preference cookie, no mismatch banner; `checkout()` shows a generic
"Checkout failed" for every refusal (`payment-facade.ts`).

**Expected behaviour:** decisions 1–6 and 8 above: `preferred_country` cookie ranked above geo on both sides,
footer switcher, one-time banner, `country_mismatch` handled with a cart re-read.

**Scope:** In: phases 1, 2, 3, 5. Out: the plan label and per-country SEO (Ticket B); a home market on the
account (backend); `ru`/`by` (backend decision).

**Acceptance criteria:** the first seven criteria above, plus the gates. **How to verify:** steps 1–3 and 6
above, plus a stubbed `country_mismatch` 4xx on checkout.

**Risks / open questions:** backend items 1 and 5 above are open; until item 1 lands the mismatch branch is
only verified with a stub.

**Estimate:** M

### Ticket B

**Summary:** `feat(seo): per-country canonical and hreflang on the plan page`
**Issue type:** Story · **Component / scope:** seo (touches payment)
**Branch:** `feat/MIL-<n>-plan-page-hreflang`
**Links:** blocked by Ticket A (`countryName()`) · `prompts/country-switcher.md`

**Context:** every route collapses its canonical onto `/us/accounting/...` because the content is identical per
country. The plan page is the exception: its prices differ per country, so collapsing it tells Google the
Indian prices are a duplicate of the US page.

**Current behaviour:** `/in/accounting/payment/plan` carries `<link rel="canonical" href=".../us/accounting/payment/plan">`
and no hreflang (`seo-route-slug.ts`); the page doesn't say which market it prices for.

**Expected behaviour:** decisions 7 and 9 above: self-canonical per country, one `hreflang` per supported
country plus `x-default` → `/us/`, every other route unchanged, sitemap unchanged, "Prices for {country} in
{currency}" label.

**Scope:** In: phases 4 and 6. Out: per-language hreflang (production is English-only).

**Acceptance criteria:** the plan-page, hreflang and sitemap criteria above, plus the gates. **How to verify:**
steps 4 and 5 above.

**Risks / open questions:** a filled `canonical_url` on the Supabase `payment/plan` row stops winning on that
page; confirm with the SEO admin.

**Estimate:** S

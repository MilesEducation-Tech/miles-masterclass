---
name: home-and-landing
description: The entry and static surfaces of Miles Masterclass v3 — the guest home page, country-variant landings (UAE CAIRA, CPA), the FAQ, legal pages, the Flutter WebView plain-layout variants, and layout shells. Read before touching features/home, features/cpa-landing, or src/app/pages.
---

# Home and landing pages

The first thing a visitor sees, plus the static/marketing surfaces. Mostly SSR'd and SEO-relevant — this is where crawler-visible content lives.

## Files

```
features/home/
├── home.ts
└── components/{home-hero,app-download,offerings/}          # offerings has offerings.config.ts
features/cpa-landing/shared/components/cpa-caira-section/

pages/
├── dynamic-layout/  main-layout/  plain-layout/  blog-layout/
├── uae-caira/                     # UAE landing + UaeCairaFacade
├── faq/  terms-of-service/  privacy-policy/  compliance/
├── connect-us/  faculty/  instructor-details/
├── ai-labs/  ai-labs-callback/
├── how-to-claim-credly-badge/
├── page-not-found/
└── shared/

layout/{header,footer,footer-overlay}/
```

## The `home` route resolves three ways

In `features.ts`, `path: ''` redirects functionally: **logged in → `masterclass`, logged out → `home`.**

Then two routes share `path: 'home'`, matched in order:

1. `canMatch: [uaeCairaMatchGuard]` → the **UAE CAIRA** landing (currently country `ae`), providing `WebinarFacade` (live-webinar registration block) and `UaeCairaFacade` (CAIRA Levels 1/2/3 carousels).
2. Falls through to `canActivate: [guestGuard]` → the standard `Home`.

`canMatch` is what makes the fallthrough work — with `canActivate` the first route would deny instead of declining, and the second would never be tried. `cpaLandingMatchGuard` follows the same pattern for the CPA variant.

Adding a country variant = a new `canMatch` guard + a route **before** the default, never an `@if` inside `Home`.

## Layout shells

| Shell            | Used for                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| `dynamic-layout` | The standard app chrome (header + footer). Wraps all feature routes.        |
| `main-layout`    |                                                                             |
| `plain-layout`   | **No header or footer** — for embedding in the Flutter native app's WebView |
| `blog-layout`    | Site chrome around the blog                                                 |

A route opts into the plain shell with `data: { layout: 'plain' }`. FAQ, terms-of-service, privacy-policy and compliance are each declared **twice** in `features.ts` — once normally and once under `mobile/` with the plain layout. Same components, different chrome. When you change one of those pages, both variants get it; when you add a new one intended for the app, add both entries.

## Home content

`home-hero`, `app-download` (→ `dialog/app-download-dialog`, driven by `app-download-prompt`), and `offerings/` — the animated section with `laptop/` and `floating-assets/`.

`laptop/laptop.ssr.notes.ts` documents the SSR constraints of that animation. **Read it before touching the laptop component.** Its config is `offerings.config.ts` — content changes go there, not into the template.

`Tracks` is provided at the `DynamicLayout` route so the whole feature tree shares one instance.

## Static pages

FAQ, terms-of-service and privacy-policy are eagerly imported in `features.ts` (not lazy) — they're small and commonly linked. Content lives in `shared/core/constant/{faq,terms-of-service,privacy-policy}.ts` and `models/legal-doc.model.ts`, not in templates. Editing copy means editing the constant.

`/:country/:profession_type/faq` is prerendered per country × profession.

`connect-us` uses the enquiry form → `SupabasePublic` (anonymous, RLS-scoped — see the `supabase` skill). `faculty` and `instructor-details` cover instructor surfaces. `page-not-found` also serves `/maintenance`.

## SEO

These pages are **static-SEO**: the root `App` component owns their tags. Only routes listed in `DYNAMIC_SLUG_PREFIXES` own their own. Don't call `SeoManager.setSeo` from a static page — you'll fight the App component. See the `seo` skill.

## Gotchas

- The guest home is `guestGuard`-protected: logged-in users never see it. Test both states.
- `plain-layout` pages are rendered inside a native WebView. No fixed headers, no `window.open`, and touch targets ≥ 44 px.
- `home` is the highest-traffic SSR route in the app. Anything eager you add here lands in the initial bundle, which is already near budget.
- `main-layout` vs `dynamic-layout` — check which one a page actually uses before changing chrome.

## Verify

```bash
pnpm start
```

1. `/` → redirects to a detected `/:country/:profession_type`.
2. Logged out → guest `Home`; logged in → `masterclass`.
3. `/ae/...` → the UAE CAIRA landing; another country → the standard home.
4. `/us/cpa/mobile/faq` — no header or footer; `/us/cpa/faq` — full chrome.
5. `connect-us` submits an enquiry anonymously.
6. `pnpm build && pnpm serve:ssr:miles-masterclass-v3`, then curl the home URL for `<title>` and `og:` tags.
7. `/us/cpa/nonsense` → page-not-found.

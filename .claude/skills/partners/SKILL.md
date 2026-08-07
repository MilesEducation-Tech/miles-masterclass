---
name: partners
description: The partner marketing pages of Miles Masterclass v3 — CPA-society and firm landing pages, the CAIRA landing, and the corporate CPE page. Read before adding or editing a partner page under features/partners.
---

# Partner landing pages

Public marketing pages for CPA societies, accounting networks and corporate clients. **Content-driven, not logic-driven** — a new partner is a config change and a route, not a new subsystem.

Distinct from the **Partner Platform** (the B2B admin console for network licensing) — that's the `partner-platform` skill.

## Files

```
features/partners/
├── partner.routes.ts
└── shared/
    ├── models/{partner-icons,caira-step-icons}.ts
    ├── components/
    │   ├── video-list-wrapper/            ← reuse this before building a video list
    │   ├── partner-content-list/
    │   ├── partnership-content/
    │   ├── for-partnership-tabs/
    │   ├── for-firms-panel/
    │   ├── partner-level-panel/
    │   ├── caira-feature-grid/
    │   └── caira-steps-grid/
    └── pages/
        ├── caira-landing/  corporate/
        ├── bkn/  ctcpa/  dscpa/  illinois/  hawaii/  ascpa/
        └── mgi-world/  mgi-north-america/  allinial-global/
```

## Routes

Mounted at `path: ''` inside `features.ts`, so they sit directly under the locale prefix:

```
/:country/:profession_type/caira
/:country/:profession_type/cpe-for-corporate
/:country/:profession_type/partners/
  boomer-knowledge-network        connecticut-society-of-cpas
  delaware-society-of-cpas        illinois-society-of-cpas
  hawaii-society-of-cpas          mgi-world
  mgi-north-america               allinial-global
```

Partner routes are declared **before** the offerings routes (both at `path: ''`), so a partner slug is matched first. `ascpa` exists as a page but its route is commented out — don't delete the component, and don't uncomment it without confirming the partnership is live.

**Slugs are public URLs printed in partner marketing material.** Never rename one without a redirect.

## Adding a partner page

1. New folder under `shared/pages/<partner-slug>/`.
2. Compose from the existing shared components — `partnership-content`, `partner-content-list`, `for-firms-panel`, `partner-level-panel`, `video-list-wrapper`. **Reuse before building**; these pages are 90% the same and the copy is what differs.
3. Add the icon to `partner-icons.ts`.
4. Register the route in `partner.routes.ts` under `partners/`.
5. Add an SEO row for the slug in the `seo_pages` Supabase table via the admin console — these are marketing pages and they must be crawlable.

If you find yourself writing a bespoke section, ask whether an existing component with different content would do. It usually would.

## CAIRA

`caira-landing` + `caira-feature-grid` + `caira-steps-grid` (icons in `caira-step-icons.ts`), plus `cpa-landing/shared/components/cpa-caira-section/`. The UAE variant is a separate page — `pages/uae-caira/` with `UaeCairaFacade` — reached through `uaeCairaMatchGuard` on the `home` route. See the `home-and-landing` skill.

`shared/components/cards/caira-credly-badge/` is the badge card used across CAIRA surfaces.

## Partner codes

Some partner pages accept a partner code that grants licensed access. That flows through `shared/core/services/partner-code/` and `dialog/partner-code-prompt-dialog`, and is redeemed against the Partner Platform. Marketing pages **capture** the code; they never validate or grant anything client-side. See the `partner-platform` skill.

## Gotchas

- These are public, SSR'd, SEO-relevant pages. Keep them `RenderMode.Server` and keep them light — they're often the first page a visitor loads.
- No auth: everything must render for an anonymous visitor.
- Partner names and logos are trademarks. Copy them exactly as supplied; don't paraphrase a partner's own description.
- Lead capture on these pages goes through `SupabasePublic` (anonymous). Never through the authenticated client.
- Reuse `video-list-wrapper` rather than building another video list — that's a repeat finding here.

## Verify

```bash
pnpm start
```

1. Every route in `partner.routes.ts` renders while logged out.
2. Partner logos, levels and content lists are correct against the supplied material.
3. Any enquiry or partner-code form submits anonymously.
4. 375 / 768 / 1280.
5. `pnpm build && pnpm serve:ssr:miles-masterclass-v3`, then curl the partner URL for `<title>` and `og:` tags.

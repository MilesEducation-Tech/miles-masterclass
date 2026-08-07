---
name: seo
description: The SEO subsystem of Miles Masterclass v3 — SeoManager tag lifecycle, the Supabase seo_pages table, static vs leaf-owned SEO ownership, the PendingTasks SSR gate, and the admin SEO console. Read before touching meta tags, canonical URLs, JSON-LD, sitemap/robots, or the admin SEO pages.
---

# SEO

Two halves: the runtime that writes tags into the page, and the admin console that edits the rows those tags come from.

## SeoManager

`src/app/shared/core/services/seo/seo-manager.ts`

| Method                                                              | Does                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setSeo(config: SeoConfig)`                                         | **Wipes every tag written by the previous call**, then writes title, description, keywords, robots, author, publisher, the full OG set (`title/description/image/video/url/type/site_name/locale`), the Twitter card set (`card/title/description/image/imageAlt/site/creator`), `<link rel="canonical">`, and a `<script id="seo-jsonld" type="application/ld+json">` block. |
| `reset()`                                                           | Removes everything it wrote. Call from `DestroyRef.onDestroy` on any leaf that owns SEO.                                                                                                                                                                                                                                                                                      |
| `loadFromSupabase(slug, fallback?, { signal?, timeoutMs? = 1500 })` | Reads a `seo_pages` row. Returns `'row' \| 'fallback' \| 'failed'`. Races `withTimeout` so SSR can't hang on Supabase.                                                                                                                                                                                                                                                        |
| `updateTitle(t)` / `updateMeta(name, content)`                      | Narrow updates that skip the full lifecycle.                                                                                                                                                                                                                                                                                                                                  |

The manager tracks every selector it writes in `previousTags` and removes them on the next `setSeo`. **That is the contract that stops tags leaking between routes** — never write a `<meta>` by hand alongside it.

## Who owns a route's SEO

The boundary is `DYNAMIC_SLUG_PREFIXES` in `shared/core/models/seo.constants.ts`:

- **Static routes** → the root `App` component sets SEO.
- **Dynamic detail routes** (course, podcast, …) → the **leaf page** owns it.

Helpers in `shared/utils/seo/`: `routeUrlToSeoSlug` (strips the `:country/:profession_type` prefix — slugs in `seo_pages` have no locale), `isDynamicSlug`, `courseToSeoConfig(course, kind)`.

Adding a new leaf-owned SEO page = one line in `DYNAMIC_SLUG_PREFIXES` + a `setupCourseSeo`-style call in the leaf.

## The SSR gate

A dynamic page must hold SSR open until its tags are written, or the serialized HTML ships without them. See `masterclass-course.ts` / `podcast-course.ts`, or the shared `setupCourseSeo` helper:

1. **Constructor, server only** — take a `PendingTasks.add()` handle. Wrap the release in a once-only function; several effects can reach it.
2. **Synchronously** call `setSeo(...)` with a URL-derived minimum. If Supabase or the course API hangs, the HTML still carries full OG/Twitter coverage owned by us, not the brand defaults from `index.html`.
3. **Effect on `courseDetails()`** — build `courseToSeoConfig(course, kind)` as the fallback and call `loadFromSupabase(slug, fallback).finally(release)`. The slug comes from `routeUrlToSeoSlug(router.url)`, lifted with `toSignal` so the effect tracks it.
4. **Error effect** — on a course-fetch error, `setSeo({ title })` from the URL and release. Without this the gate is held until SSR's own timeout.
5. `inject(DestroyRef).onDestroy(() => seoManager.reset())`.

Release the gate on **every** path. A missed release is a hung SSR response, not a missing tag.

## Sitemap and robots

`src/seo.ts`, served by the Express host. Origin comes from `environment.SITE_URL`, overridable at runtime via the `SITE_ORIGIN` env var.

## The Supabase table

`seo_pages`, read via the `Supabase` client (see the `supabase` skill). Keyed by **slug without the locale prefix**. Read from both server and browser; written only from the admin console. Anonymous reads are RLS-permitted.

## Admin SEO console

`src/app/admin/seo/`, gated by `PERM.SEO_READ` / `SEO_WRITE`:

| Route                   | Page                                      | Permission  |
| ----------------------- | ----------------------------------------- | ----------- |
| `/admin/seo`            | `seo-dashboard` — list, search, status    | `SEO_READ`  |
| `/admin/seo/edit/:slug` | `seo-editor` — per-field editor + preview | `SEO_WRITE` |
| `/admin/seo/bulk`       | `seo-bulk-upload` — CSV import            | `SEO_WRITE` |

Writes go straight to Supabase under RLS. Adding a field means the table column, `SeoConfig` in `seo.models.ts`, the `setSeo` writer, **and** the editor form — miss one and the field silently never renders.

## Verifying

Never trust dev mode — it doesn't serialize.

```bash
pnpm build && pnpm serve:ssr:miles-masterclass-v3
curl -s http://localhost:4000/us/cpa/masterclass/123/some-course | grep -E '<title>|og:|twitter:|canonical|ld\+json'
```

Then in a browser, navigate between two SEO-owning pages and confirm the count doesn't grow:

```js
document.querySelectorAll('meta[property^="og:"]').length;
```

Growth means a `reset()` isn't firing.

## Gotchas

- A route switched to `RenderMode.Client` gets **no** server-rendered tags. Crawlers see the shell.
- `og:image` must be an absolute URL built from `SITE_URL`, not a relative asset path.
- A slug with the locale prefix will never match a row — `routeUrlToSeoSlug` exists for exactly this.
- Never write meta tags directly with `Meta`/`Title` on a route `SeoManager` owns; the next `setSeo` won't know to clean them up.

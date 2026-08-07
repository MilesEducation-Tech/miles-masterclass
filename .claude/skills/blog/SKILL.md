---
name: blog
description: The headless WordPress blog in Miles Masterclass v3 — rendered natively from the WP REST API with TransferState caching, separate SSR and browser base URLs, and sanitised HTML. Read before touching features/blog or the blog routes.
---

# Blog

A headless WordPress blog rendered natively by Angular. WordPress supplies content over its REST API; this app owns the presentation. **This is the one feature that talks to neither Django nor Supabase.**

## Files

```
features/blog/
├── services/blog-api.ts                # WP REST client
├── models/blog.model.ts                # WpPost, WpCategory, BlogListQuery, BlogPostsResult
├── utils/blog.util.ts
├── pipes/safe-html-pipe.ts
├── pages/{blog-home,blog-all,blog-list,blog-post}/
└── components/{blog-card,blog-feature-card,blog-compact-item,blog-list-item,blog-banner}/

pages/blog-layout/                       # site chrome around the blog
```

## Routes

Declared at the **top level** of `app.routes.ts` — not under the locale prefix — so URLs match WordPress's own permalinks:

```
/blog-test              → BlogHome
/blog-test/all          → BlogAll        ← declared BEFORE :slug, or "all" reads as a slug
/blog-test/:slug        → BlogPost
```

Wrapped in `BlogLayout` so the site header and footer surround the blog. Declared **before** `:country/:profession_type`, or `/blog` would be captured as a country segment.

The path is currently `blog-test`. Confirm the intended production path before changing it — it's a public URL with existing inbound links.

## BlogApi

`blog-api.ts` — `getPosts(query)`, `getPostBySlug(slug)`, `getCategories()`.

Three things about it are deliberate:

**1. Two base URLs.** `environment.WP_BLOG.apiBaseUrlSsr` on the server, `apiBaseUrlBrowser` in the browser. The server may reach WordPress over an internal address the browser can't. Never collapse them into one.

**2. `TransferState` caching.** Every method writes its result under a query-derived key on the server and reads it in the browser, so hydration doesn't re-fetch what SSR already had. If you add a method, add the transfer key — otherwise every blog page double-fetches.

**3. Direct `HttpClient`, deliberately.** This is the documented exception to the `ApiClient`-only rule: WordPress is a different host with no `BASE_API_URL` and no auth. Requests carry `SKIP_AUTH_TOKEN` (don't send learner tokens to WordPress) and `SKIP_ERROR_NOTIFICATION` (a missing post shouldn't raise a global error toast). Both flags are load-bearing — keep them on new calls.

`getPostBySlug` returns `posts[0] ?? null`. A null result is a 404 page, not an error state.

## Rendering WordPress HTML

WordPress returns rendered HTML. It goes through `safe-html-pipe.ts`.

**Treat WP content as untrusted input.** Do not widen the pipe's sanitisation to make an embed work, and never reach for `bypassSecurityTrustHtml` — that's a stored-XSS path straight into the site chrome. If a legitimate embed is being stripped, extend the sanitiser's allowlist deliberately and say so in the prompt.

`blog.util.ts` holds excerpt, date and image-extraction helpers. Add to it rather than inlining string surgery in a template.

## SEO

Blog posts are public, crawlable content. They render server-side and need real titles, descriptions and `og:` tags — mapped from the WP post, not the brand defaults. Check whether the blog prefix is in `DYNAMIC_SLUG_PREFIXES` before adding leaf-owned SEO. See the `seo` skill.

## Gotchas

- Route order is load-bearing twice over: `all` before `:slug`, and the whole blog block before `:country/:profession_type`.
- The blog has **no locale prefix**. Don't add locale-dependent logic to it.
- WP pagination comes back in response headers (`X-WP-TotalPages`), not the body.
- A WP category or tag that doesn't exist yields an empty list, not an error. Render the empty state.
- Post content is arbitrary length. Test with a very long post and one with no featured image.

## Verify

```bash
pnpm start
```

1. `/blog-test` — home renders featured and recent posts.
2. `/blog-test/all` — the browse page, **not** a post lookup for the slug "all".
3. `/blog-test/<real-slug>` — the post renders with formatting and images intact.
4. `/blog-test/<nonexistent>` — a 404 page, not an error toast.
5. Network tab on a hard load: SSR fetched the post and the browser did **not** re-fetch it (TransferState working).
6. Confirm no `Authorization` header goes to the WordPress host.
7. `pnpm build && pnpm serve:ssr:miles-masterclass-v3`, then curl a post URL for `<title>` and `og:` tags.

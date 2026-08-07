---
name: supabase
description: How Miles Masterclass v3 uses Supabase — the deliberate two-client split (authenticated admin vs anonymous public), RLS as the security boundary, the seo_pages table, lead capture, and the Django-vs-Supabase data-source rule. Read before any Supabase read or write.
---

# Supabase

Supabase is a **secondary** data source. Everything learner-facing (courses, users, payments, CPE) comes from the Django REST API via `ApiClient`. Supabase holds SEO rows, admin auth, and anonymous lead capture.

## The two clients — do not merge them

`src/app/shared/core/services/supabase/`

| Service                                 | Session                                                                                    | Used for                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `Supabase` (`supabase.ts`)              | **Persisted** in localStorage on the browser; stateless on the server                      | Admin auth, `seo_pages` reads                                      |
| `SupabasePublic` (`supabase-public.ts`) | **None** — `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false` | Enquiry forms, lead capture, anything an anonymous visitor submits |

Why the split matters: once the Supabase JS client holds a persisted session, it sends that session's JWT as `Authorization: Bearer` on **every** request — including a public contact form. With one shared client, an enquiry submitted by a signed-in admin would:

1. Break RLS — policies written `to anon` stop matching.
2. Leak identity — every lead row gets stamped with the admin's `auth.uid()` instead of being anonymous.

`SupabasePublic` opts out of all session machinery so Postgres always sees role `anon`. **Never** route a public write through `Supabase`, and never add session persistence to `SupabasePublic`.

## Lazy loading

`@supabase/supabase-js` is ~150 kB and both services `import()` it dynamically, memoising the promise. A user who never hits a Supabase-backed surface never pays for it.

**Never add a top-level `import { createClient } from '@supabase/supabase-js'`** to a `providedIn: 'root'` service — it drags the whole client into the initial bundle, which is already near its 2 MB budget.

```ts
const client = await this.supabase.getClient();
const { data, error } = await client.from('seo_pages').select('*').eq('slug', slug).single();
```

## SSR

Angular creates separate injectors for server and browser, so each gets its own client instance and the `isPlatformBrowser` snapshot taken at construction stays correct for that injector's lifetime. Session persistence is browser-only; the server client is stateless.

Never provide these services in a shared injector — the platform snapshot would become a footgun.

## RLS is the security boundary

Client-side permission checks are UX, not security. Every table Supabase-backed code touches must have RLS policies that hold if someone calls the endpoint directly with the anon key.

The anon key in `environment*.ts` is **public by design** and RLS-scoped. The **service-role key must never appear in this repo** — not in an environment file, not in a comment, not in a test fixture. Privileged writes belong behind the backend, not the browser.

## Tables

| Table                                   | Read by                                                | Written by                           |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| `seo_pages`                             | `SeoManager.loadFromSupabase` (server + browser, anon) | Admin SEO console (`PERM.SEO_WRITE`) |
| Lead / enquiry tables                   | —                                                      | `SupabasePublic`, anonymous          |
| Admin auth (`auth.users` + role tables) | `AdminAuth`                                            | Supabase dashboard / admin console   |

`seo_pages` slugs **exclude** the locale prefix. See the `seo` skill.

## Django vs Supabase — which one

The admin panel reads from both, and the split is deliberate:

- **Supabase tables** → read directly from the client, RLS-enforced.
- **Django tables** → go through the API with `ApiClient` and the `IS_ADMIN_REQUEST` context token.

Guard blocks that branch on permissions in the admin have **no `else`** — an unpermitted user gets nothing rendered rather than an empty-state that implies data exists.

## Config

```ts
environment.SUPABASE = {
  url,
  anonKey,
  SupabaseUser, // localStorage key for the persisted admin session
};
```

Both services throw a clear error when the URL is unset or still the placeholder. Keep that check when refactoring — a silent no-op here surfaces as "SEO stopped working" days later.

## Checklist

- Public/anonymous write → `SupabasePublic`. Admin read/write → `Supabase`.
- Dynamic `import()`, never a top-level one.
- RLS policy exists and was reasoned about — say so in the prompt.
- No service-role key. Ever.
- Learner-facing data → Django + `ApiClient`, not Supabase.

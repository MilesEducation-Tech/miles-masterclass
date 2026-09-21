# Legacy Route → v3 Redirect Migration Plan

**Migrating live traffic from `CPE-Masterclass` (old) to `miles-masterclass-v3` (new)**

Status: **Implemented** (handler live in `src/legacy-redirects.ts`, wired in `src/server.ts`, spec in `src/legacy-redirects.spec.ts`) · pending Vercel-preview verification + product decisions in §10 · Owner: Platform/Frontend · Last updated: 2026-06-25

---

## 1. TL;DR

The old app and the new app use **fundamentally different URL shapes**. The old app keyed everything off a domain + a flat `/accounting/...` prefix. The new app keys everything off a `/:country/:profession_type/...` prefix (default `us` / `accounting`).

So the single most important rule is:

```
OLD:  /accounting/<feature>
NEW:  /<country>/accounting/<feature>     (country from geo, default "us")
```

On top of that one prefix rule, ~15 paths were **renamed or reshaped** (e.g. `premiere` → `webinar`, `terms-of-services` → `terms-of-service`, `order` → `payment/order-history`), and a handful of old features have **no equivalent yet** and need a product decision.

Because the new app is on **Vercel with a custom, function-based SSR build** (the old one was a **Firebase SPA**), the redirects belong in **`src/server.ts`** — the Express SSR entry that already runs `/version.json`, `/robots.txt`, `/sitemap.xml` and the `/blog-api` proxy _before_ Angular. That handler is guaranteed to execute (every request rewrites to `api/index` → `reqHandler`) and can read geo. Return `301`/`308` for stable URLs so SEO link-equity transfers. (Edge Middleware is **not** a safe primary here — there's no `@vercel/edge` dependency and a root `middleware.ts` isn't reliably wired into this custom build; see §6.)

> ✅ **Implemented and unit-tested against the full case matrix (all passing)** — direct prefixes, geo resolution against the real `timezone` ISO2 list, every rename/reshape, course-scoped deep links rebuilt with placeholder titles (§4.3), and the "must-not-touch" paths (`/auth`, `/admin/seo`, `/blog`, already-correct `/:country/...`, static assets). The logic lives in `src/legacy-redirects.ts` (`mapLegacyPath`), is mounted in `src/server.ts`, and is covered by `src/legacy-redirects.spec.ts`. What still needs real-deployment testing is the _wiring_ (does the handler fire + return 30x on a Vercel preview), not the rules.

> ⚠️ If we do **nothing**, an old link like `/accounting/masterclass` hitting the new app is parsed as `country=accounting`, `profession_type=masterclass`, fails `validateProfessionCountryGuard`, and dumps the user at `/us/accounting` — silently losing every deep link. That is exactly what this plan prevents.

---

## 2. Current state (what changed)

|                 | OLD — `CPE-Masterclass`                                                   | NEW — `miles-masterclass-v3`                                                    |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Framework       | Angular SPA (SSR disabled — `server.ts` commented out)                    | Angular **SSR**                                                                 |
| Hosting         | **Firebase Hosting** (`mileseducation-firebase-2`)                        | **Vercel** (serverless SSR via `api/index.mjs`)                                 |
| Routing model   | Domain-based + flat `/accounting/*` prefix                                | `/:country/:profession_type/*` prefix                                           |
| Root `/`        | Main domain → redirect to `/accounting`; Boomer domain → partner page     | `rootRedirectGuard` → `/{geoCountry}/accounting`                                |
| Default segment | literal `accounting` is the app root                                      | `accounting` is the **default profession**; country is prepended (default `us`) |
| Partner sites   | Separate subdomain (`bkn.milesmasterclass.com`) **and** `/partnerships/*` | Consolidated under `/{c}/{p}/partners/*`                                        |
| Blog            | `/blog`, `/blog/**` via Firebase function (WordPress proxy)               | Native `/blog-test` (WP REST) — comment says intended to become `/blog`         |

**Production hostnames (from old `domain.config.ts`):** `www.milesmasterclass.com`, `milesmasterclass.com` (main); `bkn.milesmasterclass.com` (Boomer partner); `cpe-masterclass-uat.web.app` (UAT).

How the new country/profession is resolved:

- `rootRedirectGuard` → `LocationService.getUserCountry()` (timezone-based, **fallback `us`**) + profession `accounting`.
- `validateProfessionCountryGuard` validates `country` against the timezone ISO2 list and `profession_type` against `PROFESSIONS`; on mismatch → `/us/accounting`.

---

## 3. The core transformation rule

For the vast majority of URLs, the only change is the prefix:

```
/accounting/<rest...>   →   /<country>/accounting/<rest...>
```

`<country>` should be resolved **at the edge** from Vercel's geo header (`x-vercel-ip-country`, lowercased), validated against the known ISO2 list, defaulting to `us`. (A static rule can hard-code `us` if geo is deemed unnecessary for legacy links — see §6.3.)

Everything below is either this rule, or a more-specific rule that must be evaluated **before** it.

---

## 4. Full redirect mapping

`{c}` = resolved country (default `us`). All targets sit under `/{c}/accounting/...`.

### 4.1 Direct — prefix change only (URL-compatible, use 301)

| Old path                                                         | New path                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/accounting`                                                    | `/{c}/accounting`                                                    |
| `/accounting/home`                                               | `/{c}/accounting/home`                                               |
| `/accounting/masterclass`                                        | `/{c}/accounting/masterclass`                                        |
| `/accounting/masterclass/:id/:topic`                             | `/{c}/accounting/masterclass/:id/:topic`                             |
| `/accounting/masterclass/:id/:topic/chapter/:chapterId/:chapter` | `/{c}/accounting/masterclass/:id/:topic/chapter/:chapterId/:chapter` |
| `/accounting/podcast`                                            | `/{c}/accounting/podcast`                                            |
| `/accounting/podcast/:id/:topic`                                 | `/{c}/accounting/podcast/:id/:topic`                                 |
| `/accounting/podcast/:id/:topic/chapter/:chapterId/:chapter`     | `/{c}/accounting/podcast/:id/:topic/chapter/:chapterId/:chapter`     |
| `/accounting/micro-learning`                                     | `/{c}/accounting/micro-learning`                                     |
| `/accounting/cpe-tracker`                                        | `/{c}/accounting/cpe-tracker` _(302 — auth-gated)_                   |
| `/accounting/faq`                                                | `/{c}/accounting/faq`                                                |
| `/accounting/connect-us`                                         | `/{c}/accounting/connect-us`                                         |
| `/accounting/cpe-for-corporate`                                  | `/{c}/accounting/cpe-for-corporate`                                  |
| `/accounting/caira`                                              | `/{c}/accounting/caira`                                              |
| `/accounting/payment`                                            | `/{c}/accounting/payment` _(302)_                                    |
| `/accounting/payment/plan`                                       | `/{c}/accounting/payment/plan` _(302)_                               |
| `/accounting/payment/cart`                                       | `/{c}/accounting/payment/cart` _(302)_                               |
| `/accounting/payment/invoice/:order_id`                          | `/{c}/accounting/payment/invoice/:order_id` _(302)_                  |
| `/accounting/library/course-library`                             | `/{c}/accounting/library/course-library`                             |
| `/accounting/library/badge-library`                              | `/{c}/accounting/library/badge-library`                              |

> Param names changed in code (`:id/:topic` → `:courseId/:courseTitle`, `:order_id` → `:orderId`) but the **URL shape is identical**, so these need no special handling — the generic prefix rule covers them.

### 4.2 Renamed / reshaped — explicit rules required (evaluate BEFORE 4.1)

| Old path                                                   | New path                                                   | Note                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `/accounting/plan`                                         | `/{c}/accounting/payment/plan`                             | old already redirected `plan` → `payment/plan` |
| `/accounting/order`                                        | `/{c}/accounting/payment/order-history`                    | feature moved under payment                    |
| `/accounting/premiere`                                     | `/{c}/accounting/webinar`                                  | **renamed** premiere → webinar                 |
| `/accounting/premiere/:id/:name`                           | `/{c}/accounting/webinar/:id/:name`                        |                                                |
| `/accounting/terms-of-services`                            | `/{c}/accounting/terms-of-service`                         | **plural → singular**                          |
| `/accounting/terms-of-services-mobile`                     | `/{c}/accounting/mobile/terms-of-service`                  | mobile webview variant                         |
| `/accounting/credly`                                       | `/{c}/accounting/how-to-claim-credly-badge`                |                                                |
| `/accounting/credly/how-to-claim`                          | `/{c}/accounting/how-to-claim-credly-badge`                |                                                |
| `/accounting/masterclass/:instructorId/expert/:expertName` | `/{c}/accounting/instructor/:instructorId/:expertName`     | instructor page moved to top level             |
| `/accounting/podcast/:instructorId/expert/:expertName`     | `/{c}/accounting/instructor/:instructorId/:expertName`     |                                                |
| `/accounting/library/masters-of-ai`                        | `/{c}/accounting/library/instructor-library`               | closest equivalent — **confirm with product**  |
| `/accounting/micro-learning/:type/:id/:title`              | `/{c}/accounting/micro-learning/:id/:title`                | **listing-filter segment dropped** (see below) |
| `/accounting/micro-learning/:type/:id`                     | `/{c}/accounting/micro-learning/:id/micro-learning-course` | no title slug → placeholder                    |
| `/accounting/micro-learning/:type`                         | `/{c}/accounting/micro-learning`                           | bare filter → listing                          |

> **micro-learning `:type`.** The old route was `/micro-learning/:type/:id/:title`, where `:type` is one of six listing filters — `explore`, `track`, `bookmark`, `completed`, `inprogress`, `course` — declared in the old route's `routeType` data. v3 dropped the segment (filters are in-page state), so its course route is just `:courseId/:courseTitle`. The generic 4.1 prefix rule does **not** cover this: it emits `/micro-learning/course/29/slug`, which v3 parses as `courseId=course` / `courseTitle=29` plus an unmatched child → `page-not-found`. The two-segment variant is worse — it 200s on the wrong course (`courseId=course`) rather than 404ing. Rules are anchored on the six literal filter words, so a course id in the first position (`/micro-learning/29/feedback/7`) still falls through to the 4.3 feedback rule.

### 4.3 Course-scoped deep links — reconstructed with a placeholder title (use 302)

The v3 course routes are `:courseId/:courseTitle`, but the old feedback / exam-start URLs carried the **course id** with no title slug. Since the title segment is display-only (the page loads off the id), we keep the course id and inject a fixed placeholder slug per offering — `masterclass-course`, `podcast-course`, `micro-learning-course`, `webinar` — landing the user on the correct course's page instead of a generic listing.

| Old path                                               | New target                                                          | Note                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `/accounting/masterclass/:id/feedback/:type`           | `/{c}/accounting/masterclass/:id/masterclass-course/feedback`       | `:id` = course id (verified)                                           |
| `/accounting/podcast/:id/feedback/:type`               | `/{c}/accounting/podcast/:id/podcast-course/feedback`               |                                                                        |
| `/accounting/micro-learning/:id/feedback/:type`        | `/{c}/accounting/micro-learning/:id/micro-learning-course/feedback` |                                                                        |
| `/accounting/premiere/:id/feedback/:type`              | `/{c}/accounting/webinar/:id/webinar/feedback`                      | premiere → webinar                                                     |
| `/accounting/masterclass/final-assessment/exam/:id`    | `/{c}/accounting/masterclass/:id/masterclass-course`                | exam-start `:id` = course id → course landing                          |
| `/accounting/podcast/final-assessment/exam/:id`        | `/{c}/accounting/podcast/:id/podcast-course`                        |                                                                        |
| `/accounting/micro-learning/final-assessment/exam/:id` | `/{c}/accounting/micro-learning/:id/micro-learning-course`          |                                                                        |
| `/accounting/<type>/final-assessment/exam/:id/report`  | `/{c}/accounting/<type>`                                            | `/report` `:id` = **session id**, no course context → listing fallback |

All are 302 (auth-gated / transient). The `/report` variant is the only one still dropped to a listing — its old `:id` is a session id, not a course id, so it can't be mapped to a specific course. The `:type` feedback segment is dropped (v3 feedback takes no type).

### 4.4 Deprecated / no equivalent in v3 — product decision needed (use 302 so target can change)

Verified absent from the v3 route tree:

| Old path                                                                               | Suggested interim target                 | Decision                                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/accounting/guides`, `/accounting/guides/:slug`, `/accounting/guides/:slug/:question` | `/{c}/accounting/home` or `/blog`        | Port guides? Fold into blog? 410 Gone?                                                                                                                                         |
| `/accounting/help-desk`                                                                | `/{c}/accounting/connect-us`             | Port help-desk?                                                                                                                                                                |
| `/accounting/credits`                                                                  | `/{c}/accounting/home`                   | Port credits page?                                                                                                                                                             |
| `/accounting/library/ai-library`                                                       | `/{c}/accounting/library/course-library` | Bring AI library back?                                                                                                                                                         |
| `/accounting/learning-pathway/:pathwaySlug/:topicId/:topicSlug`                        | `/{c}/accounting/masterclass`            | Port learning pathways?                                                                                                                                                        |
| `/accounting/sitemap`                                                                  | `/{c}/accounting/home`                   | Old staff-only sitemap **generator**; v3 serves `/sitemap.xml` from the server. Was 404ing — now 302 to home.                                                                  |
| `/accounting/become-an-instructor`                                                     | `/{c}/accounting/home`                   | Old invite for industry pros to teach a Masterclass. v3's `/faculty` is a **different** programme (AI-in-Accounting for educators), so it is not the successor. Port the page? |

### 4.5 Partners

`/partnerships/*` (and the `bkn.` subdomain) consolidate under `/{c}/accounting/partners/*` (301):

| Old                    | New                                                    |
| ---------------------- | ------------------------------------------------------ |
| `/partnerships/boomer` | `/{c}/accounting/partners/boomer-knowledge-network`    |
| `/partnerships/icpas`  | `/{c}/accounting/partners/illinois-society-of-cpas`    |
| `/partnerships/dscpa`  | `/{c}/accounting/partners/delaware-society-of-cpas`    |
| `/partnerships/ctcpa`  | `/{c}/accounting/partners/connecticut-society-of-cpas` |
| `/partnerships/hscpa`  | `/{c}/accounting/partners/hawaii-society-of-cpas`      |
| `/partnerships` (bare) | `/{c}/accounting` _(no direct landing — decision)_     |

**Subdomain consolidation:** if `bkn.milesmasterclass.com` is being retired, add a host-level 301 (DNS → Vercel, or keep it on Firebase temporarily with a redirect) sending `bkn.milesmasterclass.com/*` → `https://www.milesmasterclass.com/{c}/accounting/partners/boomer-knowledge-network`.

### 4.6 Admin (internal — 302, lower priority)

| Old                                          | New                                                    |
| -------------------------------------------- | ------------------------------------------------------ |
| `/admin`, `/admin/login`, `/admin/dashboard` | unchanged                                              |
| `/admin/dashboard/reports`                   | `/admin/reports/users`                                 |
| `/admin/dashboard/seo-manager`               | `/admin/seo`                                           |
| `/admin/dashboard/leads`                     | `/admin/dashboard` _(leads not yet ported — decision)_ |

### 4.7 Blog (coordinate separately)

Old `/blog` + `/blog/**` were a Firebase WordPress proxy. New has native `/blog-test` intended to become `/blog`. **Action:** rename `blog-test` → `blog` in `app.routes.ts`, confirm `/blog/<slug>` matches existing WP permalinks, and ensure old indexed `/blog/*` URLs keep resolving (native render or continued proxy). No country prefix — `/blog` stays top-level.

### 4.8 New-only (no redirect needed FROM old)

`/auth/login`, `/auth/signup`, `/auth/forget-password`, `/auth/profile`, `/compliance`, `/maintenance`, `/page-not-found` — these didn't exist in the old app (auth was modal-based). Nothing to redirect.

---

## 5. Correctness notes (read before implementing)

1. **The 2-segment collision is the whole reason this is tricky.** `/accounting/masterclass` has exactly two segments and will be greedily matched by the new `:country/:profession_type` route. Redirects **must** run at the edge _before_ the Angular router sees the request.
2. **Match only known legacy patterns.** The middleware/redirect layer must touch **only** `^/accounting(/|$)`, `^/partnerships(/|$)`, the listed `/admin/...` renames, and legacy partner hosts. Do **not** apply a blanket transform — leave `/auth`, `/admin` (other), `/blog`, `/compliance`, `/api`, static assets, and already-correct `/:country/:profession/...` URLs untouched. `accounting` is not a valid ISO2 code, so `^/accounting` can never be a legitimate new URL — matching it is safe.
3. **Order matters:** evaluate 4.2 / 4.3 / 4.4 (specific) **before** the generic 4.1 prefix rule.
4. **Preserve query string + hash.** UTM params and the `?dXRt=` partner-attribution param must survive the redirect (copy `url.search`). Hash fragments are client-only and are preserved by the browser automatically on 30x.
5. **301 vs 302:** use **permanent** (`301`/Vercel `308`) for stable marketing/content URLs (§4.1 non-auth, §4.2, §4.5) to pass SEO equity; use **temporary** (`302`/Vercel `307`) for auth-gated, transient, best-effort, and deprecated-fallback URLs (§4.1 payment/cpe-tracker, §4.3, §4.4, §4.6) so the target can change later.

---

## 6. Implementation strategy

### 6.1 Recommended: redirect handler in `src/server.ts` (primary — guaranteed to run)

Register one Express handler right after `registerSeoRoutes(app)` and **before** the Angular catch-all. Every request reaches this function (`vercel.json` rewrites `/(.*)` → `/api/index` → `reqHandler`), and `x-vercel-ip-country` is available for geo. This is the exact rule table that passed the 47-case unit test; `req.path` is matched and the query string from `req.originalUrl` is reattached to `Location`.

```ts
// src/server.ts — add AFTER registerSeoRoutes(app), BEFORE the Angular handler.
// LEGACY_ISO2 should come from the same `timezone` constant the app validates against.
const reshape: Array<[RegExp, (m: RegExpMatchArray, c: string) => string, boolean]> = [
  [
    /^\/accounting\/terms-of-services-mobile\/?$/,
    (_m, c) => `/${c}/accounting/mobile/terms-of-service`,
    true,
  ],
  [/^\/accounting\/terms-of-services\/?$/, (_m, c) => `/${c}/accounting/terms-of-service`, true],
  [/^\/accounting\/premiere(\/.*)?$/, (m, c) => `/${c}/accounting/webinar${m[1] ?? ''}`, true],
  [
    /^\/accounting\/credly(?:\/how-to-claim)?\/?$/,
    (_m, c) => `/${c}/accounting/how-to-claim-credly-badge`,
    true,
  ],
  [/^\/accounting\/order\/?$/, (_m, c) => `/${c}/accounting/payment/order-history`, false],
  [/^\/accounting\/plan\/?$/, (_m, c) => `/${c}/accounting/payment/plan`, true],
  [
    /^\/accounting\/(masterclass|podcast)\/([^/]+)\/expert\/([^/]+)\/?$/,
    (m, c) => `/${c}/accounting/instructor/${m[2]}/${m[3]}`,
    true,
  ],
  [
    /^\/accounting\/library\/masters-of-ai\/?$/,
    (_m, c) => `/${c}/accounting/library/instructor-library`,
    true,
  ],
  [
    /^\/accounting\/(masterclass|podcast|micro-learning)\/final-assessment\/.*$/,
    (m, c) => `/${c}/accounting/${m[1]}`,
    false,
  ],
  [
    /^\/accounting\/(masterclass|podcast|micro-learning)\/[^/]+\/feedback\/.*$/,
    (m, c) => `/${c}/accounting/${m[1]}`,
    false,
  ],
  [
    /^\/accounting\/library\/ai-library\/?$/,
    (_m, c) => `/${c}/accounting/library/course-library`,
    false,
  ],
  [/^\/accounting\/guides(\/.*)?$/, (_m, c) => `/${c}/accounting/home`, false],
  [/^\/accounting\/help-desk\/?$/, (_m, c) => `/${c}/accounting/connect-us`, false],
  [/^\/accounting\/credits\/?$/, (_m, c) => `/${c}/accounting/home`, false],
  [/^\/accounting\/learning-pathway\/.*$/, (_m, c) => `/${c}/accounting/masterclass`, false],
  [
    /^\/partnerships\/boomer\/?$/,
    (_m, c) => `/${c}/accounting/partners/boomer-knowledge-network`,
    true,
  ],
  [
    /^\/partnerships\/icpas\/?$/,
    (_m, c) => `/${c}/accounting/partners/illinois-society-of-cpas`,
    true,
  ],
  [
    /^\/partnerships\/dscpa\/?$/,
    (_m, c) => `/${c}/accounting/partners/delaware-society-of-cpas`,
    true,
  ],
  [
    /^\/partnerships\/ctcpa\/?$/,
    (_m, c) => `/${c}/accounting/partners/connecticut-society-of-cpas`,
    true,
  ],
  [
    /^\/partnerships\/hscpa\/?$/,
    (_m, c) => `/${c}/accounting/partners/hawaii-society-of-cpas`,
    true,
  ],
  [/^\/admin\/dashboard\/reports\/?$/, () => '/admin/reports/users', false],
  [/^\/admin\/dashboard\/seo-manager\/?$/, () => '/admin/seo', false],
];

app.use((req, res, next) => {
  const path = req.path;
  const isLegacy =
    /^\/(accounting|partnerships)(\/|$)/.test(path) ||
    /^\/admin\/dashboard\/(reports|seo-manager)\/?$/.test(path);
  if (!isLegacy) return next(); // leave all other routes untouched

  const ip = String(req.headers['x-vercel-ip-country'] || '').toLowerCase();
  const country = LEGACY_ISO2.has(ip) ? ip : 'us';

  let target: string | null = null,
    permanent = false;
  for (const [re, build, perm] of reshape) {
    // specific rules first
    const m = path.match(re);
    if (m) {
      target = build(m, country);
      permanent = perm;
      break;
    }
  }
  if (!target && /^\/accounting(\/|$)/.test(path)) {
    // generic prefix rule
    target = path.replace(/^\/accounting/, `/${country}/accounting`);
    permanent = !/^\/accounting\/(payment|cpe-tracker)/.test(path); // auth/transient → 307
  }
  if (!target) return next();

  const qs = req.originalUrl.includes('?')
    ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
    : '';
  res.redirect(permanent ? 308 : 307, target + qs);
});
```

**Edge Middleware alternative — only if you add `@vercel/edge` + a root `middleware.ts` and confirm it deploys** (neither exists today; this custom `buildCommand: sh vercel.sh` project does not auto-wire middleware). The identical rule set as an edge function:

```ts
// middleware.ts  (Vercel Edge Middleware)
import { next } from '@vercel/edge';

const KNOWN_ISO2 = new Set(['us', 'in', 'ae', 'gb', 'ca', 'au' /* …full timezone ISO2 list… */]);

// Specific rules first; {c} is replaced with the resolved country.
const RESHAPE: Array<[RegExp, (m: RegExpMatchArray) => string, boolean]> = [
  [
    /^\/accounting\/terms-of-services-mobile\/?$/,
    () => '/{c}/accounting/mobile/terms-of-service',
    true,
  ],
  [/^\/accounting\/terms-of-services\/?$/, () => '/{c}/accounting/terms-of-service', true],
  [/^\/accounting\/premiere(\/.*)?$/, (m) => `/{c}/accounting/webinar${m[1] ?? ''}`, true],
  [
    /^\/accounting\/credly(?:\/how-to-claim)?\/?$/,
    () => '/{c}/accounting/how-to-claim-credly-badge',
    true,
  ],
  [/^\/accounting\/order\/?$/, () => '/{c}/accounting/payment/order-history', false],
  [/^\/accounting\/plan\/?$/, () => '/{c}/accounting/payment/plan', false],
  [
    /^\/accounting\/(masterclass|podcast)\/([^/]+)\/expert\/([^/]+)\/?$/,
    (m) => `/{c}/accounting/instructor/${m[2]}/${m[3]}`,
    true,
  ],
  [
    /^\/accounting\/library\/masters-of-ai\/?$/,
    () => '/{c}/accounting/library/instructor-library',
    true,
  ],
  // best-effort deep links → listing (302)
  [
    /^\/accounting\/(masterclass|podcast|micro-learning)\/final-assessment\/.*$/,
    (m) => `/{c}/accounting/${m[1]}`,
    false,
  ],
  [
    /^\/accounting\/(masterclass|podcast|micro-learning)\/[^/]+\/feedback\/.*$/,
    (m) => `/{c}/accounting/${m[1]}`,
    false,
  ],
  // deprecated → interim fallback (302; change target after product decision)
  [/^\/accounting\/library\/ai-library\/?$/, () => '/{c}/accounting/library/course-library', false],
  [/^\/accounting\/guides(\/.*)?$/, () => '/{c}/accounting/home', false],
  [/^\/accounting\/help-desk\/?$/, () => '/{c}/accounting/connect-us', false],
  [/^\/accounting\/credits\/?$/, () => '/{c}/accounting/home', false],
  [/^\/accounting\/learning-pathway\/.*$/, () => '/{c}/accounting/masterclass', false],
  // partners
  [/^\/partnerships\/boomer\/?$/, () => '/{c}/accounting/partners/boomer-knowledge-network', true],
  [/^\/partnerships\/icpas\/?$/, () => '/{c}/accounting/partners/illinois-society-of-cpas', true],
  [/^\/partnerships\/dscpa\/?$/, () => '/{c}/accounting/partners/delaware-society-of-cpas', true],
  [
    /^\/partnerships\/ctcpa\/?$/,
    () => '/{c}/accounting/partners/connecticut-society-of-cpas',
    true,
  ],
  [/^\/partnerships\/hscpa\/?$/, () => '/{c}/accounting/partners/hawaii-society-of-cpas', true],
  // admin renames (302)
  [/^\/admin\/dashboard\/reports\/?$/, () => '/admin/reports/users', false],
  [/^\/admin\/dashboard\/seo-manager\/?$/, () => '/admin/seo', false],
];

export default function middleware(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Only act on legacy patterns; everything else passes through untouched.
  if (
    !/^\/(accounting|partnerships)(\/|$)/.test(path) &&
    !/^\/admin\/dashboard\/(reports|seo-manager)\/?$/.test(path)
  ) {
    return next();
  }

  const geo = (req.headers.get('x-vercel-ip-country') || 'us').toLowerCase();
  const country = KNOWN_ISO2.has(geo) ? geo : 'us';

  let target: string | null = null;
  let permanent = false;

  for (const [re, build, perm] of RESHAPE) {
    const m = path.match(re);
    if (m) {
      target = build(m).replace('{c}', country);
      permanent = perm;
      break;
    }
  }
  // generic prefix rule (after specific rules)
  if (!target && /^\/accounting(\/|$)/.test(path)) {
    target = path.replace(/^\/accounting/, `/${country}/accounting`);
    permanent = !/^\/accounting\/(payment|cpe-tracker|order)/.test(path); // auth/transient → 302
  }
  if (!target) return next();

  url.pathname = target; // preserves url.search automatically
  return Response.redirect(url, permanent ? 308 : 307);
}

export const config = {
  matcher: ['/accounting/:path*', '/partnerships/:path*', '/admin/dashboard/:path*'],
};
```

> Populate `KNOWN_ISO2` from the same `timezone` ISO2 source the app uses, so this and `validateProfessionCountryGuard` agree. **Reminder:** prefer the `src/server.ts` handler above — this edge variant is only worth it if you've confirmed middleware actually deploys for this project.

### 6.2 `vercel.json` redirects (for the static, geo-independent subset)

Renames that don't need geo can also be expressed declaratively (these run before the catch-all rewrite). Country still has to be injected, so a fixed `us` default is the trade-off here:

```jsonc
// add to vercel.json, BEFORE the existing "rewrites"
"redirects": [
  { "source": "/accounting/terms-of-services", "destination": "/us/accounting/terms-of-service", "permanent": true },
  { "source": "/accounting/premiere/:rest*",   "destination": "/us/accounting/webinar/:rest*",   "permanent": true },
  { "source": "/partnerships/boomer",          "destination": "/us/accounting/partners/boomer-knowledge-network", "permanent": true }
  // …etc. Note: no geo — everyone lands on "us".
]
```

Prefer the **§6.1 `server.ts` handler** as the single source of truth so geo + path-shape stay in one place; use `vercel.json` only if you explicitly accept a fixed-country default.

### 6.3 Country default: geo vs fixed `us`

- **Geo (recommended):** the §6.1 handler reads `x-vercel-ip-country` → legacy visitors keep their region. Note a minor inconsistency: the app's own `LocationService` resolves country from **browser timezone**, not IP, so a redirected visitor's country may occasionally differ from a fresh visitor's. Both default to `us`, so impact is small.
- **Fixed `us`:** simpler (works in pure `vercel.json`), but every redirected visitor lands on `/us/...` regardless of location. Acceptable if region accuracy for _legacy_ links is low-value.

### 6.4 Old Firebase side (only if the old domain is NOT immediately repointed)

If there's a transition window where `cpe-masterclass-uat.web.app` / the old domain still serves Firebase while the new app is on a **different** domain, add 301s in `firebase.json` so the old host forwards to the new host:

```jsonc
"redirects": [
  { "source": "/accounting/**", "destination": "https://www.milesmasterclass.com/us/accounting/:splat", "type": 301 },
  { "source": "/partnerships/boomer", "destination": "https://www.milesmasterclass.com/us/accounting/partners/boomer-knowledge-network", "type": 301 }
]
```

If instead the production domain is simply **repointed** from Firebase to Vercel (most likely), this section is unnecessary — all redirects live in the new app (§6.1).

### 6.5 Angular in-app safety net (optional, low cost)

For stale **in-app** links that bypass the server (SPA navigations to a hardcoded legacy path), add a tiny guard so the client also recovers gracefully:

```ts
// app.routes.ts — append BEFORE the '**' wildcard
{ path: 'accounting', children: [{ path: '**', canActivate: [legacyRedirectGuard], children: [] }] },
```

`legacyRedirectGuard` rebuilds the URL with the resolved country and `router.navigateByUrl(...)`. The `server.ts` handler is the real fix; this only covers internal navigations that were never server requests.

---

## 7. SEO & analytics

- **301/308** for §4.1 (non-auth), §4.2, §4.5 so PageRank/link-equity transfers; **302/307** elsewhere.
- **Regenerate `sitemap.xml`** with the new `/{c}/accounting/...` URLs and resubmit in Google Search Console; keep the old sitemap reachable briefly so Google recrawls and sees the 301s.
- **Canonical tags** on new pages must point to the new URLs (no `/accounting`-only canonicals left behind).
- Verify **`Content-Security-Policy`** (already in `vercel.json`) still allows everything the redirected pages load.
- Preserve **UTM / `dXRt`** query params through every redirect (the old partner flow depends on `?dXRt=`).
- Update **GA4 / GTM** path-based goals & funnels for the new URL shape; annotate the cutover date.

---

## 8. Testing plan

Build a redirect matrix (old URL → expected new URL + expected status) and assert it:

1. **Unit test the transform** — a pure function `mapLegacy(path, country)` covering every row in §4 (table-driven). Cheapest, run in CI.
2. **Integration / curl** on a Vercel preview: `curl -sI https://<preview>/accounting/masterclass` → expect `308` + correct `Location`; repeat for every §4 row including a query string (`?utm_source=x&dXRt=y`) and trailing slashes.
3. **Geo** — send `x-vercel-ip-country: IN` (and a junk value) → assert `/in/...` and `/us/...` fallback respectively.
4. **No-touch assertions** — `/auth/login`, `/admin/seo`, `/blog/some-post`, `/us/accounting/masterclass` (already-correct), `/assets/x.js` must return **non-redirect**.
5. **Auth deep link** — `/accounting/payment/cart` → `/{c}/accounting/payment/cart` → then the app's `authGuard` flow.
6. **Manual sweep** of the top 20–50 URLs from current GA/Search Console (highest-traffic + best-indexed) before flipping DNS.

Suggested high-value verification URLs: `/accounting`, `/accounting/masterclass`, `/accounting/podcast`, `/accounting/premiere`, `/accounting/terms-of-services`, `/accounting/credly`, `/accounting/order`, `/accounting/payment/plan`, `/partnerships/boomer`.

---

## 9. Rollout

1. **Decide** the §4.4 deprecated-feature targets and the §4.7 blog rename with product.
2. **Confirm domain plan:** repoint `www.milesmasterclass.com` to Vercel (preferred) vs keep old Firebase alive temporarily (§6.4). Confirm fate of `bkn.` subdomain.
3. **Implement** middleware (§6.1) + `KNOWN_ISO2` list; rename `blog-test` → `blog`.
4. **Verify** on a Vercel preview deployment using the §8 matrix.
5. **Regenerate sitemap**, set canonicals.
6. **Cut over** (DNS / domain assignment) during a low-traffic window.
7. **Monitor** 404s, redirect-loop alarms, GSC coverage, and analytics for 1–2 weeks; keep the old deployment available for fast rollback.

---

## 10. Open decisions for the team

1. **Domain model:** same-domain repoint (redirects live in new app) or temporary dual-domain (also add Firebase 301s)? — _drives §6.1 vs §6.4._
2. **Country default:** geo-aware (`x-vercel-ip-country`) or fixed `us`? — _§6.3._
3. **Deprecated features** (`guides`, `help-desk`, `credits`, `library/ai-library`, `learning-pathway`): port, fold elsewhere, or `410 Gone`? — _§4.4._
4. **`library/masters-of-ai` → `library/instructor-library`**: confirm that's the right successor. — _§4.2._
5. **Admin `leads`**: ported later or permanently dropped? — _§4.6._
6. **Blog:** rename `blog-test` → `blog` and serve natively, or keep the WordPress proxy for `/blog/*`? — _§4.7._
7. **`bkn.milesmasterclass.com`** subdomain: retire with a host-level 301, or keep live? — _§4.5._

```

```

# Analytics & Engagement Integration Plan

### Microsoft Clarity + Google Tag Manager + Netcore Cloud (CE)

**Project:** `miles-masterclass-v3`
**Stack:** Angular 21 (standalone, signals) · SSR via `@angular/ssr` + custom Express (`src/server.ts`) · Vercel (function `api/index.mjs`) · Supabase (admin panel + SEO content only). **End-user auth is your own API (`api.milesmasterclass.com`) via the `Auth` service** — that, not Supabase, is the identity used for analytics.
**Author:** Implementation plan — review before coding
**Last updated:** 2026-06-18

---

## 1. Goal & guiding principle

Wire up three tools without hurting SSR, hydration, SEO, or Core Web Vitals:

| Tool                         | Purpose                                                                                               | Primary owner   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | --------------- |
| **Google Tag Manager (GTM)** | Tag hub + GA4 host. Lets marketing add/change tags without a deploy.                                  | Marketing + Eng |
| **Microsoft Clarity**        | Session recordings, heatmaps, rage/dead-click insights.                                               | Marketing/UX    |
| **Netcore Cloud (CE)**       | User identity, event tracking, segmentation, email/SMS/WhatsApp journeys, **web push notifications**. | Growth/CRM      |

**Guiding principle:** _one typed Angular `Analytics` service is the single source of truth._ It initialises the vendors (browser-only), owns the `dataLayer`, listens to the router, and exposes `trackPageView()` / `trackEvent()` / `identify()`. GTM, Clarity and the GA4 tag are delivered **through GTM**; Netcore's SDK + service worker are installed **in Angular** because they need your app ID and the **logged-in end-user's identity from the `Auth` service** (your `api.milesmasterclass.com` auth — _not_ Supabase, which is admin-only). The service is **fully disabled on `/admin/**`** (see §7.6). Nothing is pasted ad-hoc into `index.html`.

### Why programmatic injection (not raw snippets in `index.html`)

Your app already has the right pattern for this — `app.config.ts` eagerly boots `Network` and `UpdateChecker.init()` via `provideEnvironmentInitializer()`, and `UpdateChecker` is documented as _"browser-only; a no-op during SSR."_ We mirror that exactly. Reasons:

- **Per-environment IDs.** You ship three builds (`environment.ts` → prod `.com`, `environment.development.ts` → UAT `.us`, `environment.local.ts`). `index.html` is shared across all of them, so a hard-coded GTM/Clarity/Netcore ID there would send UAT + local traffic into the production property. Reading IDs from `environment.*` keeps them separated.
- **SSR safety.** Injection happens inside `afterNextRender()` / behind `isPlatformBrowser`, so vendor scripts never execute during server render and can't break hydration (`provideClientHydration` with event replay + incremental hydration is active).
- **Consent gating.** A service can hold tags until consent is granted; a static snippet fires immediately.
- **Identity.** Netcore `identify()` must run when the end-user's `Auth.currentUser` resolves (your app API auth, _not_ the admin Supabase session) — that's Angular state, not something a GTM tag can see cleanly.

### Data flow

```
Angular App (browser only)
   │
   ├─ Analytics service ──► window.dataLayer ──► GTM container
   │        │                                      ├─► GA4 config + event tags
   │        │                                      └─► Microsoft Clarity tag (official template)
   │        │
   │        └─ smartech('dispatch', …) ──────────► Netcore CE  (events, segments, journeys)
   │
   ├─ Auth.currentUser (end-user, app API) ─ effect ─► smartech('identify', <app user id>)
   │
   └─ /sw.js (static, public/) ─ registered by Netcore SDK ─► Web Push (VAPID/FCM, APNS for Safari)

   ⛔ Everything above is DISABLED on /admin/** — admin uses Supabase auth and is never tracked.
```

---

## 2. Accounts & assets to create first (no code)

Create everything **per environment** so UAT never pollutes production.

**Google Tag Manager / GA4**

- [ ] GTM account → **two containers**: `GTM-XXXX-PROD` (`.com`) and `GTM-XXXX-UAT` (`.us` + local).
- [ ] GA4 property (+ a separate UAT data stream, or a dedicated UAT property). Note the Measurement ID `G-XXXX`.

**Microsoft Clarity**

- [ ] Clarity project for prod; a second project for UAT. Note each **Project ID**.

**Netcore Cloud (CE)**

- [ ] Identify your **data centre / region** (default vs **EU DC** — the script URL and `create()` signature differ; see §6).
- [ ] Add **Website assets**: one for `www.milesmasterclass.com`, one for `www.milesmasterclass.us`. ⚠️ **A domain, once added in Netcore, cannot be deleted** — enter carefully, include/exclude `www` exactly as your canonical host.
- [ ] Note the **Smartech Panel identifier** (`create`) and **Website identifier** (`register`) per asset.
- [ ] For web push: decide **VAPID** (Netcore generates the key pair — simplest) vs **FCM** (needs a Firebase project: Server/API key, Sender ID, Project ID, App ID). For Safari, **APNS** certificate.
- [ ] Download the **`sw.js`** file from _Get JavaScript SDK_ for each website asset.

> Decision needed: VAPID vs FCM, and DC region. VAPID is recommended unless you already run FCM web push elsewhere. See Open Questions (§11).

---

## 3. Phase 0 — Foundations (do this before any vendor)

### 3.1 Environment config

Add an `ANALYTICS` block to **all three** env files, following your existing nested-config + `process.env` override convention.

`src/environments/environment.ts` (production):

```ts
ANALYTICS: {
  gtmId: 'GTM-XXXXPROD',
  ga4Id: 'G-XXXXXXX',            // only if you ever load gtag directly; normally lives inside GTM
  clarityProjectId: 'xxxxxxxxxx',
  netcore: {
    panelId: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // smartech('create', …)
    websiteId: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',          // smartech('register', …)
    region: '' as '' | 'eu',                            // 'eu' → EU DC script + region arg
    swPath: '/sw.js',
    webPush: true,
  },
  consentRequired: true,         // gate everything behind consent until granted
},
```

Repeat in `environment.development.ts` (UAT IDs) and `environment.local.ts` (blank IDs / `enabled:false` so localhost never sends data). Mirror the runtime-override style used in `seo.ts`/`server.ts` if you want to flip IDs without a redeploy (e.g. `process.env['GTM_ID']`).

### 3.2 The `Analytics` service (SSR-safe core)

New folder: `src/app/shared/core/services/analytics/` → `analytics.ts` (matches your `seo/seo-manager.ts`, `network/network.ts` layout).

Responsibilities:

- Declare `window.dataLayer` and a typed `gtag`/push helper.
- `init()` — **browser-only** (guard with `isPlatformBrowser(PLATFORM_ID)`, run DOM work in `afterNextRender`). No-op on the server, exactly like `UpdateChecker`.
- `injectGtm()`, `injectClarity()` (if not via GTM), `injectNetcore()`.
- `trackPageView(url, title)` and `trackEvent(name, params)` → `dataLayer.push` (+ optional `smartech('dispatch', …)`).
- `identify(user)` / `resetIdentity()`.
- Hold all calls in a queue until consent is granted when `consentRequired` is true.

Skeleton:

```ts
import { Injectable, PLATFORM_ID, Injector, inject, afterNextRender, effect } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { environment } from '../../../../../environments/environment';
import { Auth } from '../auth/auth';

declare global {
  interface Window {
    dataLayer: unknown[];
    smartech?: (...args: unknown[]) => void;
    clarity?: (...a: unknown[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class Analytics {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly doc = inject(DOCUMENT);
  private readonly auth = inject(Auth);
  private readonly injector = inject(Injector); // for the effect created inside afterNextRender
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly cfg = environment.ANALYTICS;
  private booted = false;

  init(): void {
    if (!this.isBrowser || this.booted) return; // SSR no-op
    if (this.isAdmin(this.doc.location.pathname)) return; // never load analytics in the admin panel
    this.booted = true;
    afterNextRender(() => {
      window.dataLayer = window.dataLayer || [];
      if (!this.cfg.consentRequired) this.loadAll(); // else wait for grantConsent()
      // Re-identify whenever the end-user profile (Auth service / app API) resolves or changes.
      // NOTE: effect() must be created in an injection context — afterNextRender's
      // callback is not one, so pass the captured injector explicitly.
      effect(
        () => {
          const user = this.auth.currentUser();
          if (user) this.identify(user);
          else this.resetIdentity();
        },
        { injector: this.injector },
      );
    });
  }

  grantConsent(): void {
    if (this.isBrowser) this.loadAll();
  }

  private loadAll(): void {
    this.injectGtm();
    this.injectNetcore(); /* Clarity via GTM */
  }

  trackPageView(url: string, title?: string): void {
    if (!this.isBrowser || this.isAdmin(url)) return; // skip SSR + admin routes
    window.dataLayer?.push({
      event: 'virtual_page_view',
      page_path: url,
      page_title: title ?? this.doc.title,
    });
    window.smartech?.('dispatch', 'Page Browse', { page_url: location.href });
  }

  trackEvent(name: string, params: Record<string, unknown> = {}): void {
    if (!this.isBrowser || this.isAdmin(this.doc.location.pathname)) return;
    window.dataLayer?.push({ event: name, ...params });
    window.smartech?.('dispatch', name, params);
  }

  private identify(user: { id?: string | number; email?: string }): void {
    // Use the app user id (NOT email) as the Netcore primary key — see §7.5 PII hygiene.
    window.smartech?.('identify', String(user.id ?? ''));
    window.dataLayer?.push({ event: 'login', user_id: user.id });
  }
  private resetIdentity(): void {
    /* clear on logout if needed */
  }

  /** /admin/** is admin-only (Supabase auth) and must never be tracked. */
  private isAdmin(path: string): boolean {
    return /^\/admin(\/|$)/.test(path);
  }
  // injectGtm/injectNetcore in later phases
}
```

Register it at boot in `src/app/app.config.ts`, next to the existing initializers:

```ts
provideEnvironmentInitializer(() => { inject(Analytics).init(); }),
```

### 3.3 Route tracking (reuse the existing SEO subscription)

`app.ts` already subscribes to `NavigationEnd` and calls `this.seoManager.loadFromSupabase(slug, …).finally(...)`. The page **title is set asynchronously** by `SeoManager`, so firing GA4 at `NavigationEnd` would capture a stale title. **Fire the virtual pageview in the existing `.finally()`** so the title is correct:

```ts
const releaseToken = this.pendingTasks.add();
this.seoManager.loadFromSupabase(slug, seoForRoute).finally(() => {
  this.analytics.trackPageView(event.urlAfterRedirects, this.doc.title); // ← add
  releaseToken();
});
```

For dynamic routes (the `isDynamicSlug` branch that returns early), call `trackPageView` from each leaf component after its own SEO resolves. Configure GA4's tag with **`send_page_view: false`** (see §4) so you don't get duplicate page views. `trackPageView` already early-returns on `/admin/**`, so admin navigations emit nothing (§7.6).

### 3.4 Consent scaffolding

Add a minimal consent gate (or a CMP). Until consent: push GTM **Consent Mode v2** defaults (`denied`) and don't init Clarity/Netcore. On grant: call `analytics.grantConsent()` and update consent state. Details consolidated in §7.

---

## 4. Phase 1 — Google Tag Manager + GA4

1. **Inject GTM** in `Analytics.injectGtm()` (browser-only) using the container ID from `environment.ANALYTICS.gtmId`:

```ts
private injectGtm(): void {
  const id = this.cfg.gtmId; if (!id) return;
  const s = this.doc.createElement('script'); s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  this.doc.head.appendChild(s);
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
}
```

_(The `<noscript>` iframe is pointless for a JS-required SPA, so skip it.)_

2. **In the GTM UI:**
   - Add the **GA4 Configuration tag** with your Measurement ID. Set field **`send_page_view = false`**.
   - Create a **Custom Event trigger** on `virtual_page_view` → fire a GA4 **event tag** `page_view` with `page_location` / `page_path` / `page_title` from Data Layer Variables. This is the SPA-correct pattern (avoids the double-pageview problem).
   - Create Data Layer Variables for the common params in §8.

3. **Performance:** add `<link rel="preconnect" href="https://www.googletagmanager.com">` to `index.html` head (you already curate preconnects there). GTM loads `async`, so it won't block LCP.

4. **CSP:** your `vercel.json` CSP already allows this — `script-src … https:`, `connect-src 'self' https: wss:`, `img-src … https: data:`. No change needed for GTM/GA4. (Tighten later by replacing `https:` with explicit hosts if desired.)

5. **QA:** GTM **Preview/Debug** → confirm container loads, `virtual_page_view` fires once per SPA navigation, GA4 Realtime shows the page views with correct titles.

---

## 5. Phase 2 — Microsoft Clarity

**Recommended: deploy via GTM** (fastest, no code, marketer-manageable).

1. In GTM, **Tag → Discover more tag types → "Microsoft Clarity - Official"** community template. Enter the **Clarity Project ID**. Trigger: **All Pages** (or **Consent Initialization / after consent** if gated). Publish.
2. Clarity auto-handles SPA route changes once loaded — no extra code.
3. **Masking (do this before turning recordings on — it is not retroactive and takes up to ~1h to apply):** this is an authenticated platform for accounting professionals, so recordings will capture PII.
   - Keep masking mode **Balanced** as the floor (input boxes and dropdowns are always masked in every mode and can't be unmasked).
   - For `auth/*`, profile, and `payment/*` checkout views, add **element masking** in the Clarity dashboard (CSS selectors, e.g. `.payment-form`, `#profile-email`) or annotate the DOM with `data-clarity-mask="True"` on sensitive containers — it masks that node and all children. Consider **Strict** mode on payment routes.
   - Verify nothing sensitive is visible by reviewing a test recording.
4. **GA4 link:** connect Clarity ↔ GA4 in Clarity settings so you can jump from a GA4 segment to its recordings.
5. **Consent:** if gated, use Clarity's consent signal (Consent Mode) so recording only starts post-consent.

**QA:** Realtime → a recording for your own session appears within minutes; open it and confirm email/payment fields are masked.

---

## 6. Phase 3 — Netcore Cloud (CE) incl. Web Push

Netcore is installed **in Angular** (not GTM) because of identity + the service worker. The global is `smartech(...)`.

### 6.1 SDK init (browser-only, non-blocking)

Use the **`defer` + `onload`** pattern from Netcore's docs so rendering isn't blocked. Build it in `Analytics.injectNetcore()` from env IDs:

```ts
private injectNetcore(): void {
  const n = this.cfg.netcore; if (!n?.panelId) return;
  const base = n.region === 'eu'
    ? '//cdnt.netcoresmartech.com/smartechclient-osjs-eu.js'
    : '//cdnt.netcoresmartech.com/smartechclient.js';
  const s = this.doc.createElement('script');
  s.id = 'smtclient_v1'; s.src = base; s.defer = true;
  s.onload = () => {
    const st = window.smartech!;
    n.region === 'eu' ? st('create', n.panelId, 'eu') : st('create', n.panelId);
    st('register', n.websiteId);
    st('identify', String(this.auth.currentUser()?.id ?? '')); // empty = anonymous
    st('dispatch', 'Page Browse', { page_url: location.href });
  };
  this.doc.head.appendChild(s);
}
```

- Pass the **app user's primary key from the `Auth` service** (`currentUser().id` — your `api.milesmasterclass.com` identity, _not_ Supabase) to `identify` for logged-in users; leave **empty** to capture anonymously. Prefer the user **id over email** for the Netcore key (§7.5). The `effect()` in §3.2 re-calls `identify` when `Auth.currentUser` flips. Admin/Supabase sessions are never tracked (§7.6).
- SDK is ~45 KB over CDN. Add `<link rel="preconnect" href="https://cdnt.netcoresmartech.com">` to `index.html`.

### 6.2 The service worker (`sw.js`) — the biggest gotcha

Netcore web push needs **`sw.js` served from the site root** (`https://…/sw.js`).

1. Drop the downloaded **`sw.js` into `public/`**. Your `angular.json` copies `public/**/*` to the browser dist root, so it will be served at `/sw.js`. ✅ (EU DC variant `importScripts('//cdnt.netcoresmartech.com/sw-eu.js')` — use the file Netcore gives you for your region.)
2. **⚠️ Cache-Control conflict (must fix).** `vercel.json` currently sets `Cache-Control: public, max-age=31536000, immutable` for **all** `*.js`. A service worker must **not** be cached for a year or push updates will never propagate. Add a dedicated `/sw.js` rule and make sure it wins over the generic `.js` rule:

```jsonc
{
  "source": "/sw.js",
  "headers": [
    { "key": "Cache-Control", "value": "no-cache, max-age=0, must-revalidate" },
    { "key": "Service-Worker-Allowed", "value": "/" },
  ],
}
```

> Verify precedence after deploy: open DevTools → Network → `/sw.js` and confirm the `Cache-Control` is the `no-cache` value, not the year-long `immutable` one. When two `headers` entries set the same key for a path, Vercel applies them in array order — if the immutable value still wins, reorder so the `/sw.js` entry takes effect (and exclude `sw.js` from the generic `.js` matcher if needed).

3. **CSP for the worker:** your CSP has `worker-src 'self' blob:` (good — same-origin `/sw.js` is allowed) and `script-src … https:` (good — the worker's `importScripts('//cdnt.netcoresmartech.com/…')` is allowed). No change, but verify in DevTools → Application → Service Workers after deploy.
4. **No Angular service worker today** (no `ngsw-config.json`) — so there's **no SW conflict** right now. ⚠️ If you ever add `@angular/pwa`/ngsw later, it registers its own root-scope SW and **will collide** with Netcore's. Mitigation then: use Netcore's **Custom Service Worker** option (custom filename) or a scoped registration, per Netcore's _Coexistence_ docs.

### 6.3 Web push enablement (panel side)

In Netcore: **Settings → Websites → Advanced features → enable Browser Push Notification**, then:

- **VAPID (recommended):** click **Generate** — Netcore creates the public/private keys; tokens collect as users subscribe. No Firebase needed.
- **FCM:** supply Server/API key, Sender ID, Project ID, App ID from Firebase.
- **Safari:** upload the **APNS** certificate.

### 6.4 Opt-in UX (important for conversion + UX)

**Do not fire the browser permission prompt on first load** — it tanks opt-in rates and annoys users. Gate it behind a **Netcore double opt-in / soft prompt** triggered by intent (e.g. after enrolling in a masterclass, completing a chapter, or a "Notify me about new drops" CTA). Wire the soft-prompt acceptance to request the native permission.

### 6.5 SPA event + page tracking

- Netcore won't see SPA route changes automatically. The `Analytics.trackPageView()` already dispatches `Page Browse` on each navigation. Also set **SPA delay settings** for your website asset in the Netcore panel (per their SPA note) so the SDK handles client-side route transitions correctly.
- Map the key business events (§8) to `smartech('dispatch', …)` via `trackEvent()`.

**QA:** Netcore panel → tokens appear as you subscribe; events show under user activity; send a test web push to your own browser; verify identity stitches anonymous → known after login.

---

## 7. Compliance, consent & security (global)

This is a CPE/education platform handling professional PII across `.com` + `.us` (and potentially worldwide) audiences, so consent and security are first-class, not a follow-up.

### 7.1 Yes — all three are in scope of GDPR (and equivalents)

All three set cookies / persistent IDs and process personal data, so under EU/UK GDPR they need a **lawful basis — consent — collected _before_ they load**, plus a signed **Data Processing Agreement (DPA)** with each vendor.

| Tool                  | Personal data it touches                            | IDs / cookies                   | Vendor role                                          | Load only after consent?        |
| --------------------- | --------------------------------------------------- | ------------------------------- | ---------------------------------------------------- | ------------------------------- |
| **GA4 (via GTM)**     | IP (not stored), device, behaviour, `user_id`       | `_ga`, `_ga_*`                  | Processor — Google DPA                               | **Yes** (EEA/UK)                |
| **Microsoft Clarity** | Session recordings, clicks, IP, behaviour           | `_clck`, `_clsk`                | Processor — Microsoft DPA                            | **Yes**                         |
| **Netcore CE**        | Email/phone (CRM), behaviour, push token, `user_id` | first-party + push subscription | Processor — Netcore DPA; **India-HQ → cross-border** | **Yes**, + explicit push opt-in |

GTM itself is just a loader (collects nothing), but it's the gate that fires the others, so consent is enforced at the GTM / Consent-Mode layer.

### 7.2 One geo-aware consent model for every country

"Compliant in all countries" = apply the **right rule per visitor region**, which in practice means a **Consent Management Platform (CMP)** (or an equivalent in-house banner) with geo-detection:

- **Opt-in regions** — EU/EEA, UK, Switzerland; treat **Brazil (LGPD)** and **India (DPDP Act)** the same way: load **nothing** non-essential until the user actively accepts. Default = denied.
- **Opt-out regions** — US (California **CCPA/CPRA**, plus VA/CO/CT/etc.): may load by default but must offer **"Do Not Sell or Share My Personal Information"** and honour the **Global Privacy Control (GPC)** browser signal.
- **Record proof of consent** — timestamp, policy version, and choices — for audit.

**Recommended:** a **Google-certified CMP** (Cookiebot, OneTrust, Osano, CookieYes, Termly, or Iubenda) wired to **Google Consent Mode v2**. It writes one consent state your `Analytics` service reads before calling `grantConsent()`. An in-house banner is possible but you'd own geo-rules, GPC handling, and audit logging yourself.

### 7.3 Per-tool compliance configuration

- **GTM + GA4:** implement **Consent Mode v2** (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization` default `denied`; update on accept). Sign the Google DPA, set GA4 **data retention** to the minimum needed, keep IP-anonymisation (GA4 default — no IP stored), document the **GA4 user-deletion API** for DSARs.
- **Clarity:** only start recording after analytics consent (Consent-Mode aware); keep **masking** as the safety floor regardless (§5); sign the Microsoft DPA; use Clarity data export/delete for DSARs.
- **Netcore:** load the SDK and request push **only after consent / explicit opt-in**; use the **EU data centre** for EU users (data-residency + the India cross-border concern); wire the **GDPR opt-in/opt-out** and **Erase User Data** APIs into your DSAR process; sign the Netcore DPA.

### 7.4 Governance & documentation (non-code, but required)

Sign DPAs with all three; publish an updated **Privacy Policy** + a **Cookie Policy** (each cookie, purpose, retention); add a **ROPA** entry; define a **data-retention schedule**; map a **DSAR / erasure workflow** to each tool's deletion mechanism. Assign an owner and re-audit cookies periodically.

### 7.5 Security

- **Tighten the CSP.** Today `script-src 'self' 'unsafe-inline' 'unsafe-eval' https:` allows _any_ HTTPS script (plus inline + eval) — a broad supply-chain surface. Move to an **explicit allowlist** and drop `'unsafe-eval'` if nothing needs it. Roll out behind **`Content-Security-Policy-Report-Only`** first to catch breakage before enforcing. Hosts to allow:
  - `script-src`: `https://www.googletagmanager.com`, `https://*.clarity.ms`, `https://cdnt.netcoresmartech.com`
  - `connect-src`: `https://*.google-analytics.com`, `https://*.analytics.google.com`, `https://*.clarity.ms`, Netcore collection/push endpoints
  - keep `img-src` (GA/Clarity beacons), `frame-src`, `worker-src` as today.
- **PII hygiene / data minimisation.** Never push access/refresh tokens, raw email, payment fields, or auth cookies into `dataLayer` or to any vendor. Use the **app user id (not email)** for `identify`; hash if policy requires. Also a **PCI** point — card fields must never reach Clarity (mask) or any tag.
- *_Exclude `/admin/**` and other sensitive areas\*_ from all tracking (§7.6) — privacy *and\* security (admin screens can expose other users' PII).
- **GTM is a code-injection vector.** Restrict publish rights (least privilege, 2-person review), use GTM **environments/approvals**, prefer **official templates** over Custom HTML (e.g. the Clarity template), and monitor container versions.
- **Service worker.** Serve `sw.js` same-origin with `Service-Worker-Allowed: /`; CSP `worker-src 'self'` + `script-src https:` already constrain it; review the `importScripts` source Netcore ships.
- **SRI isn't viable** for these scripts (vendors update them continuously) — rely on the CSP allowlist + vendor DPAs + HTTPS/HSTS (already enabled).

### 7.6 Identity source & admin exclusion (corrected from v1)

- **End-user identity = the app `Auth` service** (`currentUser()` from `api.milesmasterclass.com`). **Supabase is admin-only** and must **not** supply end-user analytics identity.
- **No analytics on `/admin/**`.** The `Analytics`service skips init when the landing path is admin, and`trackPageView`/`trackEvent`early-return on admin URLs (the`isAdmin()`helper in §3.2). If an admin navigates from the public site into`/admin`, call `clarity('stop')` on entry as defense-in-depth so panel sessions are never recorded.

---

## 8. Shared event taxonomy (so all three get consistent data)

Define once in a constants file (e.g. `analytics.events.ts`) and push via `trackEvent()`. Starter set for a course platform:

| Event                               | When                               | Key params                            |
| ----------------------------------- | ---------------------------------- | ------------------------------------- |
| `virtual_page_view`                 | every route change (post-SEO)      | `page_path`, `page_title`             |
| `sign_up` / `login`                 | auth success                       | `method`, `user_id`                   |
| `view_course`                       | masterclass/podcast/webinar detail | `course_id`, `course_type`, `title`   |
| `start_course` / `complete_chapter` | playback milestones                | `course_id`, `chapter_id`, `progress` |
| `view_pricing`                      | `payment/plan` page                | `plan_tier`                           |
| `begin_checkout` / `purchase`       | plan checkout                      | `plan`, `value`, `currency`           |
| `push_opt_in`                       | web-push permission granted        | `source`                              |

Keep names snake_case (GA4 convention); Netcore accepts the same names via `dispatch`.

---

## 9. File-by-file change summary

**New files**

- `src/app/shared/core/services/analytics/analytics.ts` — the service, incl. `isAdmin()` exclusion (§3.2, §4, §6, §7.6).
- `src/app/shared/core/services/analytics/analytics.spec.ts` — SSR no-op, admin-exclusion, and consent-queue tests.
- `src/app/shared/core/constant/analytics.events.ts` — event name constants (§8).
- `public/sw.js` — Netcore service worker (§6.2).
- `src/app/shared/core/services/consent/consent.ts` (+ banner component, or a CMP integration) — single consent state wired to Consent Mode v2 (§7.2).

**Edited files**

- `src/environments/environment.ts`, `environment.development.ts`, `environment.local.ts` — add `ANALYTICS` block; blank IDs in `local` (§3.1).
- `src/app/app.config.ts` — `provideEnvironmentInitializer(() => inject(Analytics).init())` (§3.2).
- `src/app/app.ts` — call `analytics.trackPageView(...)` inside the existing SEO `.finally()` (§3.3).
- `src/index.html` — `preconnect` for `googletagmanager.com` + `cdnt.netcoresmartech.com` (§4, §6.1).
- `vercel.json` — `/sw.js` cache + `Service-Worker-Allowed` override (§6.2); begin **CSP allowlist** via `Content-Security-Policy-Report-Only` (§7.5).
- `src/app/shared/core/constant/privacy-policy.ts` (+ a new Cookie Policy) — disclose Clarity, GA4, Netcore (§7.4).
- Leaf components for dynamic routes — `trackPageView` after their SEO resolves (§3.3).

---

## 10. Rollout sequence & verification

1. **Phase 0** foundations → merge behind blank IDs (no-op). Verify SSR build still renders (`pnpm build:prod`) and hydration is clean (no console warnings).
2. **Phase 1 GTM/GA4** on **UAT (`.us`)** first → GTM Preview + GA4 Realtime QA → promote to prod container.
3. **Phase 2 Clarity** on UAT → confirm masking on a real recording → prod.
4. **Phase 3 Netcore** on UAT → SDK loads, `sw.js` registers, identity stitches, test push delivered → prod.
5. **Consent** verified end-to-end (nothing fires pre-consent).
6. **Performance gate:** run Lighthouse before/after on home + a course page; confirm no LCP/TBT regression (all three load `async`/`defer`, post-render).

**Definition of done per tool**

- GTM: container live, `virtual_page_view` fires once/navigation, GA4 Realtime correct.
- Clarity: recordings + heatmaps populating, PII masked, GA4 linked.
- Netcore: tokens collecting, events in panel, identify works, web push deliverable on Chrome + Safari, opt-in gated behind intent.

### Performance safeguards (must not regress Core Web Vitals)

- All vendor scripts load **after hydration** (`afterNextRender`) and **`async`/`defer`** — never render-blocking, never on the SSR critical path.
- **Consent-gated loading** means pre-consent / non-consenting visitors download nothing — often a net speed win.
- **`preconnect`** the three vendor origins; load the ~45 KB Netcore SDK on **`requestIdleCallback`** (or first interaction) so it never competes with LCP.
- **Don't prompt for push on load** (CLS + UX hit) — trigger from intent (§6.4).
- Keep Clarity at default **sampling**; raise only if data volume requires.
- Set a **Lighthouse / CrUX budget** and compare LCP / INP / CLS / TBT before vs after each phase on the home page and a course page.
- _(Optional, advanced)_ offload GTM to a web worker via **Partytown** to free the main thread — adds SSR complexity; only if profiling shows GTM is the bottleneck.

---

## 11. Open questions / decisions needed

1. **Netcore DC region** — default or **EU**? (Changes script URL + `create()` signature.)
2. **Web push provider** — **VAPID** (recommended, Netcore-generated keys) or **FCM** (needs Firebase)? Safari APNS in scope now or later?
3. **Consent / CMP** — adopt a Google-certified CMP (Cookiebot / OneTrust / Osano / CookieYes / Termly / Iubenda) or build an in-house banner? Which jurisdictions are in scope (EU/UK opt-in, US CCPA/CPRA opt-out, India DPDP, Brazil LGPD), and must we honour **GPC**?
4. **Route Netcore events through GTM too?** (Netcore also supports _JS Integration via GTM_.) Default here: SDK direct in Angular, events via the `Analytics` service. Marketer-managed Netcore tags can be added in GTM later.
5. **GA4** — net-new property, or an existing one to reuse?
6. **Engagement overlap** — you already have an `EngagementDialog` service; decide where Netcore web messages/nudges should and shouldn't overlap with it.
7. **Vendor DPAs** — who signs the Google, Microsoft, and Netcore DPAs, and by when?
8. **`identify()` key** — confirm the `Auth` field used as the Netcore primary key (user `id` preferred; hashed email only if required).
9. **Data residency** — confirm **EU DC** for Netcore + GA4 EU regional settings for EU traffic.

---

## Sources

- Netcore — [Web SDK overview](https://developer.netcorecloud.com/docs/web-sdk-integration), [Direct JS integration](https://developer.netcorecloud.com/docs/direct-js-integration), [Customer Engagement / Web Push (VAPID/FCM/APNS)](https://developer.netcorecloud.com/docs/web-customer-engagement-user), [JS integration via GTM](https://developer.netcorecloud.com/docs/js-integration-via-gtm), [Coexistence with 3rd-party JS](https://developer.netcorecloud.com/docs/coexistence-in-js)
- Microsoft Clarity — [Install via Google Tag Manager](https://learn.microsoft.com/en-us/clarity/third-party-integrations/google-tag-manager), [Masking content](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking)
- GTM/GA4 SPA — [Track single-page apps with GA4 + GTM (send_page_view:false, virtual pageviews)](https://www.analyticsmania.com/post/single-page-web-app-with-google-tag-manager/)

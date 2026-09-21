import { Injectable, Injector, PLATFORM_ID, afterNextRender, effect, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../../environments/environment';
import { Consent } from '../consent/consent';
import { Logger } from '../logger/logger';
import { ConsentState } from '../../models/consent.model';
import { User } from '../../models/profile.model';
import { CurrentPlanData } from '../../models/payment.model';
import { AnalyticsEvent } from '../../constant/analytics-events';
import { MilesActivity } from '../miles-activity/miles-activity';

type GtagConsentValue = 'granted' | 'denied';

interface ClarityQueue {
  (...args: unknown[]): void;
  q?: unknown[][];
}

/** Standard payload for a tracked click — sent to GA4 (`element_click`) + Netcore. */
export interface ClickEventData {
  click_tag: string;
  type_tag: string;
  click_text: string;
  click_id: string;
  click_element: string;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    smartech?: (...args: unknown[]) => void;
    clarity?: ClarityQueue;
  }
}

/**
 * Single source of truth for analytics + engagement.
 *
 * - **Gated per environment**: a no-op unless `ANALYTICS.enabled` (browser only).
 *   Each vendor is then gated by its own `ga4/clarity/netcore.enabled` flag.
 * - **SSR-safe**: all DOM work runs in `afterNextRender`; nothing executes on the server.
 * - **Admin-excluded**: never initialises or tracks on `/admin/**` (Supabase admin area).
 * - **Consent-gated** (opt-in): Consent Mode v2 defaults to `denied`; GTM loads as the
 *   consent gatekeeper, and Clarity (analytics tier) + Netcore (marketing tier) are only
 *   injected once the matching consent is granted.
 *
 * Depends on {@link Consent} (reads its signals via `effect`); Consent does NOT depend on
 * Analytics, so there is no DI cycle.
 */
@Injectable({ providedIn: 'root' })
export class Analytics {
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly consent = inject(Consent);
  private readonly logger = inject(Logger);
  private readonly milesActivity = inject(MilesActivity);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly cfg = environment.ANALYTICS;

  /**
   * Master switch — the per-environment `ANALYTICS.enabled` flag, browser only.
   * Each environment file decides whether analytics runs; individual vendors
   * are then gated by their own `*Enabled` flag in the inject* methods below.
   */
  private readonly active = this.cfg.enabled && this.isBrowser;

  private booted = false;
  private gtmLoaded = false;
  private clarityLoaded = false;
  private netcoreLoaded = false;
  private lastIdentitySig = '';
  private lastLocale: { country: string; profession: string } = { country: '', profession: '' };
  private static readonly NON_LOCALE_PREFIXES = new Set([
    'auth',
    'admin',
    'blog',
    'blog-test',
    'page-not-found',
    'maintenance',
    'mobile',
  ]);

  /** Called once at boot from app.config.ts (provideEnvironmentInitializer). */
  init(): void {
    if (!this.active || this.booted) return;
    if (this.isAdmin(this.doc.location.pathname)) return; // never track the admin panel
    if (this.isOAuthCallback(this.doc.location.pathname)) return; // nor the OAuth popup
    this.booted = true;

    afterNextRender(() => {
      this.bootConsentMode(); // denied defaults BEFORE the GTM container loads
      this.injectGtm(); // container loads; tags inside it wait for consent
      this.bindClickTracking(); // delegated [data-click-tag] click capture

      // Apply the saved / just-made consent to Consent Mode + vendor loaders,
      // and emit `consent_update` on user-driven changes (not the returning-
      // visitor load, where the decision predates this session).
      const consentPreDecided = this.consent.hasDecision();
      let consentApplied = false;
      effect(
        () => {
          if (!this.consent.hasDecision()) return;
          const state = this.consent.state();
          this.applyConsent(state);
          if (consentApplied || !consentPreDecided) {
            this.trackEvent('consent_update', {
              analytics: state.analytics,
              marketing: state.marketing,
              functional: state.functional,
            });
          }
          consentApplied = true;
        },
        { injector: this.injector },
      );

      // ponytail: this effect re-identified on profile/plan changes, both read
      // from the removed session service. Analytics now only ever sees the
      // anonymous identity — `identify()` is still public, so re-wire by
      // calling it from wherever a user becomes known again.
      this.resetIdentity();
    });
  }

  // ---- Public tracking API ------------------------------------------------

  /** Fire a virtual pageview (call after SEO/title resolves). */
  trackPageView(url: string, title?: string): void {
    this.rememberLocale(url);
    // Miles360 mirror — first-party CRM, so it sits ABOVE the consent guard and
    // carries its own (see MilesActivity).
    this.milesActivity.send('virtual_page_view', {
      page_path: url,
      page_title: title ?? this.doc.title,
    });
    if (!this.active || !this.consent.hasDecision() || this.isAdmin(url)) return;
    window.dataLayer?.push({
      event: 'virtual_page_view',
      page_path: url,
      page_title: title ?? this.doc.title,
    });
    window.smartech?.('dispatch', 'Page Browse', { page_url: this.doc.location.href });
  }

  /** Fire a custom event to GA4 (via dataLayer) and Netcore. */
  trackEvent(name: AnalyticsEvent, params: Record<string, unknown> = {}): void {
    // Miles360 mirror — first-party CRM, so it sits ABOVE the consent guard and
    // carries its own (see MilesActivity). Covers trackClick and trackPurchase
    // too, since both delegate here.
    this.milesActivity.send(name, params);
    if (!this.active || !this.consent.hasDecision() || this.isAdmin(this.doc.location.pathname)) {
      return;
    }
    window.dataLayer?.push({ event: name, ...params });
    // Netcore activity params must be flat primitives — drop arrays/objects (e.g. items[]).
    window.smartech?.('dispatch', name, this.flattenParams(params));
    if (this.cfg.debug) this.logger.debug(`[analytics] ${name}`, params);
  }

  /**
   * Fire a click event to GA4 (`element_click` via dataLayer) and Netcore with
   * the standard payload. Usually triggered automatically by the delegated
   * listener for any element carrying `data-click-tag`; call it directly if you
   * need to track a click that can't be annotated in the template.
   */
  trackClick(data: ClickEventData): void {
    this.trackEvent('element_click', { ...data });
  }

  /**
   * Fire a GA4 `purchase` (ecommerce) + Netcore, deduped by `transaction_id`
   * via localStorage so a refresh of the post-payment success page can't
   * double-count revenue. (GA4 also dedupes by transaction_id as a backstop.)
   */
  trackPurchase(data: { transaction_id: string } & Record<string, unknown>): void {
    if (!this.active || !this.consent.hasDecision() || this.isAdmin(this.doc.location.pathname)) {
      return;
    }
    const id = String(data.transaction_id ?? '');
    const key = `mm_purchase_${id}`;
    try {
      if (id && window.localStorage.getItem(key)) return; // already counted
      if (id) window.localStorage.setItem(key, String(Date.now()));
    } catch {
      // localStorage blocked (private mode) — proceed without cross-refresh dedupe.
    }
    this.trackEvent('purchase', data);
  }

  // ---- GA4 account-lifecycle events (CPE-Masterclass parity) --------------

  /*
   * The three methods below are ported 1:1 from CPE-Masterclass so the GA4 event
   * NAMES and user-property KEYS are identical across both apps. They sit
   * ALONGSIDE the existing consent / identify pipeline and never modify it; they
   * are gated by the same consent decision as every other hit (see emitLifecycle).
   *
   * v3's User model has no `profession` or app-download flag, so
   * `onboarding_question_1` is sourced from `job_role.name` and `app_downloaded`
   * is reported as `'false'`.
   */

  /**
   * `account_create` — fire on first successful login (is_existing_user === false).
   * `plan` is usually absent at OTP-verify, so subscription_status resolves to
   * "inactive", matching CPE.
   */
  trackAccountCreate(user: User, plan: CurrentPlanData | null = null): void {
    this.emitLifecycle('account_create', {
      ...this.lifecycleProperties(user, plan),
      app_downloaded: 'false',
      onboarding: 'false',
    });
  }

  /** `onboarding` — fire when a brand-new user first completes the profile form. */
  trackOnboarding(user: User, plan: CurrentPlanData | null = null): void {
    this.emitLifecycle('onboarding', {
      ...this.lifecycleProperties(user, plan),
      onboarding: 'true',
    });
  }

  /** `profile_update` — fire on every later profile update by an existing user. */
  trackProfileUpdate(user: User, plan: CurrentPlanData | null = null): void {
    this.emitLifecycle('profile_update', this.lifecycleProperties(user, plan));
  }

  /**
   * Register GA4 `user_id` + user properties for the current user SYNCHRONOUSLY,
   * so they precede any event fired in the same tick.
   *
   * The {@link init} identify effect normally does this, but Angular effects run
   * asynchronously — so activation events emitted right after `setAuthenticated`
   * (e.g. `sign_up` / `account_create`) would otherwise be sent BEFORE the user
   * properties are set. Call this immediately after `setAuthenticated`. identify()
   * dedupes via `lastIdentitySig`, so the later effect run is a no-op.
   */
  flushIdentity(): void {
    // ponytail: no session layer to read an identity from — always anonymous.
    this.resetIdentity();
  }

  /**
   * Shared user-property payload for the lifecycle events, keyed IDENTICALLY to
   * CPE-Masterclass. Intentionally separate from v3's own {@link userProperties}
   * — these are the CPE keys, not v3's.
   */
  private lifecycleProperties(user: User, plan: CurrentPlanData | null): Record<string, string> {
    const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return {
      // Cross-system id, falling back to the numeric `id` (mirrors
      // Auth.primaryKey) — the webinar-registration user payload carries only
      // `id`, not `miles_user_id`.
      uuid: user.miles_user_id || (user.id != null ? String(user.id) : ''),
      name,
      onboarding_question_1: user.job_role?.name ?? '',
      onboarding_question_2: user.sector?.name ?? '',
      subscription_status: (plan?.subscription_status ?? 'inactive').toLowerCase(),
    };
  }

  /**
   * Persist the CPE user properties on GA4 (`set`, config-only) and push the
   * named event carrying the same payload — mirroring CPE's setUserProperties +
   * dataLayer push shape `{ event, user_properties, ...props }`. Gated by the
   * same `active + consent decision + non-admin` rule as {@link trackEvent}.
   */
  private emitLifecycle(name: AnalyticsEvent, props: Record<string, string>): void {
    // Miles360 mirror — first-party CRM, so it sits ABOVE the consent guard and
    // carries its own (see MilesActivity).
    this.milesActivity.send(name, props);
    if (!this.active || !this.consent.hasDecision() || this.isAdmin(this.doc.location.pathname)) {
      return;
    }
    window.gtag?.('set', 'user_properties', props);
    window.dataLayer?.push({ event: name, user_properties: props, ...props });
  }

  // ---- Consent Mode v2 ----------------------------------------------------

  private bootConsentMode(): void {
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function gtag() {
        // gtag must push the real `arguments` object — GA reads it positionally.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer?.push(arguments);
      };
    }
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'denied',
      personalization_storage: 'denied',
      security_storage: 'granted',
      wait_for_update: 500,
    });
    window.gtag('js', new Date());
  }

  private applyConsent(state: ConsentState): void {
    const v = (granted: boolean): GtagConsentValue => (granted ? 'granted' : 'denied');
    window.gtag?.('consent', 'update', {
      analytics_storage: v(state.analytics),
      ad_storage: v(state.marketing),
      ad_user_data: v(state.marketing),
      ad_personalization: v(state.marketing),
      functionality_storage: v(state.functional),
      personalization_storage: v(state.functional),
      security_storage: 'granted',
    });
    if (state.analytics) this.injectClarity();
    if (state.marketing) this.injectNetcore();
  }

  // ---- Vendor loaders (each injects at most once) -------------------------

  private injectGtm(): void {
    if (this.gtmLoaded || !this.cfg.ga4.enabled || !this.cfg.ga4.gtmId) return;
    this.gtmLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = this.doc.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${this.cfg.ga4.gtmId}`;
    this.doc.head.appendChild(s);
  }

  private injectClarity(): void {
    if (this.clarityLoaded || !this.cfg.clarity.enabled || !this.cfg.clarity.projectId) return;
    this.clarityLoaded = true;
    if (!window.clarity) {
      const queue: ClarityQueue = (...args: unknown[]) => {
        (queue.q = queue.q || []).push(args);
      };
      window.clarity = queue;
    }
    const t = this.doc.createElement('script');
    t.async = true;
    t.src = `https://www.clarity.ms/tag/${this.cfg.clarity.projectId}`;
    this.doc.head.appendChild(t);
  }

  private injectNetcore(): void {
    if (this.netcoreLoaded || !this.cfg.netcore.enabled || !this.cfg.netcore.siteKey) return;
    this.netcoreLoaded = true;
    const n = this.cfg.netcore;
    const s = this.doc.createElement('script');
    s.id = 'smtclient_v1';
    s.src = n.scriptUrl;
    s.defer = true;
    s.onload = () => {
      const st = window.smartech;
      if (!st) return;
      st('create', n.siteKey); // Smartech panel identifier
      st('register', n.appId); // website identifier (matches the siteid in n.swPath's SW)
      // Web-push: register the Netcore/FCM service worker. `/sw.js` is generated
      // per-build by the SSR server (src/service-worker.ts) with the matching
      // FCM + siteid config.
      if (n.webPush && 'serviceWorker' in navigator) {
        navigator.serviceWorker
          .register(n.swPath)
          .catch((err) => this.logger.error('Netcore web-push SW registration failed', err));
      }
      // ponytail: no session layer — Netcore is always identified anonymously.
      st('identify', ''); // empty = anonymous
      st('dispatch', 'Page Browse', { page_url: this.doc.location.href });
    };
    this.doc.head.appendChild(s);
  }

  // ---- Identity & user properties -----------------------------------------

  /**
   * Set identity + user attributes on GA4 and Netcore. Called whenever the
   * end-user profile or plan changes. GA4 user properties are gated downstream
   * by Consent Mode (analytics tier); Netcore calls no-op until its SDK is
   * loaded under marketing consent.
   */
  private identify(user: User, plan: CurrentPlanData | null): void {
    const key = this.primaryKey(user);
    const props = this.userProperties(user, plan);
    // Skip redundant re-identify — currentUser and currentPlan can both emit for
    // the same profile, which would otherwise duplicate the user_data push.
    const signature = `${key}|${JSON.stringify(props)}`;
    if (signature === this.lastIdentitySig) return;
    this.lastIdentitySig = signature;
    // GA4 — `set` only stores config (no network hit), so it's safe pre-consent;
    // the user_data *event* is gated like every other hit.
    window.gtag?.('set', { user_id: key });
    window.gtag?.('set', 'user_properties', props);
    if (this.consent.hasDecision()) {
      window.dataLayer?.push({ event: 'user_data', user_id: key, user_properties: props });
    }
    // Enhanced Conversions — hashed email for Google Ads matching. Marketing-
    // consent only; never the raw address. Fire-and-forget (SHA-256 is async).
    void this.setHashedUserData(user);
    // Netcore — identity + contact attributes for segmentation.
    this.setNetcoreUser(key, props);
  }

  /**
   * Set GA4 user-provided data (Enhanced Conversions) — a SHA-256 hash of the
   * normalized email so Google Ads can match conversions without us ever
   * exposing the raw address. Gated on marketing consent; no-op without an
   * email, marketing consent, or `crypto.subtle` (insecure/SSR context).
   */
  private async setHashedUserData(user: User): Promise<void> {
    const email = user.email?.trim().toLowerCase();
    if (!email || !this.consent.state().marketing || !globalThis.crypto?.subtle) return;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
    const sha256_email_address = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    window.gtag?.('set', 'user_data', { sha256_email_address });
    window.dataLayer?.push({ user_data: { sha256_email_address } });
  }

  /** Clear identity on logout. */
  private resetIdentity(): void {
    this.lastIdentitySig = '';
    window.gtag?.('set', { user_id: null });
  }

  /**
   * The single user-attribute set, sent IDENTICALLY to GA4 (as user properties —
   * register as user-scoped custom dimensions) and to Netcore (as contact
   * attributes). Rebuilt and re-sent on every profile/plan change via the
   * identify effect, so both platforms always hold the latest values. NO raw PII
   * (no email / phone / name) — ids + categories only.
   */
  private userProperties(user: User, plan: CurrentPlanData | null): Record<string, string> {
    const { country, profession } = this.localeFromPath();
    return {
      profile_completed: String(user.is_profile_completed === true),
      plan_status: (plan?.subscription_status ?? 'none').toLowerCase(),
      currently_working: String(!!user.is_currently_working),
      sector: user.sector?.name ?? '',
      job_role: user.job_role?.name ?? '',
      license_status: user.license_status ?? '',
      qualification_status: user.qualification_status ?? '',
      // Profile-collected segmentation attributes (non-PII). Arrays are joined
      // to a scalar since GA4 user properties must be strings.
      state_board: user.state_board_name?.join(', ') ?? '',
      company: user.company?.[0]?.company_name ?? '',
      country,
      profession,
    };
  }

  /**
   * Locale (`/:country/:profession/...`) for user properties. Cached and only
   * updated from locale-shaped paths, so the value survives non-locale routes
   * like `/auth/login` (where login happens) instead of becoming `auth/login`.
   */
  private localeFromPath(): { country: string; profession: string } {
    this.rememberLocale(this.doc.location.pathname);
    return this.lastLocale;
  }

  private rememberLocale(path: string): void {
    const seg = path.split('/').filter(Boolean);
    if (seg[0] && !Analytics.NON_LOCALE_PREFIXES.has(seg[0]) && seg[1]) {
      this.lastLocale = { country: seg[0], profession: seg[1] };
    }
  }

  /**
   * Netcore identity + contact attributes. The SAME property set sent to GA4
   * (see {@link userProperties}) is attached to the Netcore contact, so identity
   * data stays at parity across both platforms. An empty `listId` means the
   * global list (`0`) — i.e. every identified user. Each attribute must also
   * exist in the Netcore panel (Data → Contacts → Attributes) to be stored.
   */
  private setNetcoreUser(key: string, props: Record<string, string>): void {
    const st = window.smartech;
    if (!st) return;
    st('identify', key);
    // Empty `listId` → 0 (global list): attach the GA4 user properties to every
    // identified contact, no per-list configuration required.
    st('contact', this.cfg.netcore.listId || 0, { 'pk^customerid': key, ...props });
  }

  /** Netcore primary key — the cross-system `miles_user_id`, falling back to `id`. */
  private primaryKey(user: User): string {
    return user.miles_user_id || String(user.id);
  }

  // ---- Delegated click tracking -------------------------------------------

  /**
   * Attach one capture-phase listener that tracks clicks on any element (or
   * ancestor) carrying `data-click-tag`. Capture phase so it still fires even
   * if a component stops propagation on the click.
   */
  private bindClickTracking(): void {
    this.doc.addEventListener('click', this.onDocumentClick, true);
  }

  private readonly onDocumentClick = (event: Event): void => {
    const target = event.target as Element | null;
    const el = target?.closest<HTMLElement>('[data-click-tag]');
    if (!el || this.isAdmin(this.doc.location.pathname)) return;
    // Never capture text from PII-bearing elements — opt out via `data-click-notext`
    // or Clarity's `data-clarity-mask`.
    const suppressText = !!el.closest('[data-click-notext],[data-clarity-mask]');
    this.trackClick({
      click_tag: el.dataset['clickTag'] ?? '',
      type_tag: el.dataset['typeTag'] ?? '',
      click_text: suppressText
        ? ''
        : (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 100),
      click_id: el.id || (el.dataset['clickId'] ?? ''),
      click_element: el.tagName.toLowerCase(),
    });
  };

  /** Netcore activity params must be flat primitives — strip arrays/objects. */
  private flattenParams(
    params: Record<string, unknown>,
  ): Record<string, string | number | boolean> {
    const flat: Record<string, string | number | boolean> = {};
    for (const [k, val] of Object.entries(params)) {
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        flat[k] = val;
      }
    }
    return flat;
  }

  /** `/admin/**` is admin-only (Supabase auth) and must never be tracked. */
  private isAdmin(path: string): boolean {
    return /^\/admin(\/|$)/.test(path);
  }

  /**
   * The OAuth callback popup must never be tracked, for two reasons.
   *
   * Security: it lands as `…/ai-labs-callback#access_token=…&refresh_token=…`,
   * and a session recorder that captures URLs would ship those credentials to a
   * third party.
   *
   * Stability: it is a transient, machine-only window that nobody looks at, yet
   * booting analytics there loads GTM + Clarity + Netcore into it. Clarity
   * patches `history.replaceState`, which is exactly what supabase-js calls to
   * strip that (multi-KB) fragment the moment the page opens.
   */
  private isOAuthCallback(path: string): boolean {
    return path.startsWith(environment.AI_LABS.redirectPath);
  }
}

import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, PLATFORM_ID, Service, inject, signal } from '@angular/core';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@env/environment';
import { Logger } from '@core/services/logger/logger';
import { Storage } from '@core/services/storage/storage';
import {
  AI_LAB_LAST_EMAIL_KEY,
  clearAiLabSession,
} from '@core/services/ai-lab-auth/ai-lab-session';

const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 640;
/** How often to re-check for a session while the sign-in popup is open. */
const POLL_MS = 500;
/** Give up waiting if the user abandons the popup without signing in. */
const SIGN_IN_TIMEOUT_MS = 5 * 60_000;
/**
 * How long focus must sit on the opener before we assume the popup is gone. Long enough for a
 * just-completed callback's storage write and channel message to land, so finishing the sign-in
 * never flashes the retry hint.
 */
const RETURN_GRACE_MS = 1200;

/**
 * Cap on the whole platform-logout teardown. The caller hard-navigates the moment we resolve, so a
 * slow (or silently blocked) Microsoft response must never be the thing that holds a logout open.
 */
const LOGOUT_TIMEOUT_MS = 2000;

/**
 * Where "Launch AI Lab" goes: Copilot Studio, which picks up the Microsoft session the sign-in left
 * on `login.microsoftonline.com`. The same URL in every environment.
 */
export const COPILOT_STUDIO_URL = 'https://copilotstudio.microsoft.com/';

/**
 * Same-origin channel the callback page uses to tell the opener it's done.
 *
 * Needed because `Cross-Origin-Opener-Policy` severs the opener↔popup link the moment the popup
 * navigates to Microsoft: after that the opener's handle is a restricted proxy (`popup.closed` is
 * permanently `true`, `popup.close()` is a no-op) and the callback page sees
 * `window.opener === null`. BroadcastChannel doesn't depend on that relationship at all — only on
 * the two documents being same-origin, which they are.
 */
export const AI_LAB_CHANNEL = environment.AI_LABS.AI_LABS_CHANNEL;
export const AI_LAB_CALLBACK_DONE = environment.AI_LABS.AI_LABS_CALLBACK_DONE;

/**
 * Entra (Azure AD) sign-in for AI Labs, via Supabase Auth — upstream's `AiLabAuth`, ported.
 *
 * A **third** Supabase client, separate from `Supabase` (admin) and `SupabasePublic`. It has to
 * be: it points at a different project entirely (the labs project), and supabase-js sends its
 * persisted session as `Authorization: Bearer` on every request it makes — so sharing an instance
 * would cross-contaminate identities (AGENTS.md §7). A distinct `storageKey` keeps the sessions
 * from overwriting each other in browser storage.
 *
 * Why a popup rather than a full-page redirect: the AI Labs page is a marketing landing page, and a
 * redirect loses scroll position and state. Microsoft's login page sends `X-Frame-Options`, so an
 * in-page modal is impossible — a popup is the only way to keep the user on the page while they
 * authenticate.
 *
 * The Copilot Studio hand-off relies on a side effect of this flow: the OAuth round-trip goes
 * through `login.microsoftonline.com`, which leaves a Microsoft session cookie in the browser.
 * Copilot Studio then picks up that same account when we open it.
 *
 * Root, and in core: Miles logout (`AuthSession`) drops this session too, and core can't import a
 * feature. `@supabase/supabase-js` loads on first use, so nothing joins the initial bundle.
 */
@Service()
export class AiLabAuth {
  private readonly logger = inject(Logger);
  private readonly storage = inject(Storage);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private client: SupabaseClient | null = null;
  private clientPromise: Promise<SupabaseClient> | null = null;

  /** Releases an in-flight `awaitSession`; see the retry note in `signIn`. */
  private abortWait: (() => void) | null = null;
  /** Only the newest attempt is allowed to clear `signingIn`. */
  private attempt = 0;
  /** `onAuthStateChange` is registered once, not once per `restoreSession`. */
  private authListenerBound = false;
  /** Distinguishes a deliberate sign-out from a dead session; see `handleAuthChange`. */
  private userSignedOut = false;

  /** Drives the hero: signed-out shows Login, signed-in shows Launch. */
  readonly isSignedIn = signal(false);
  readonly signingIn = signal(false);
  /** `restoreSession` is reading storage — `isSignedIn` isn't trustworthy yet. */
  readonly restoring = signal(false);
  /** Email of the signed-in lab account, for "Signed in as" and switching away from it. */
  readonly identity = signal<string | null>(null);
  /** Something went wrong and the user should know. Rendered as destructive. */
  readonly error = signal<string | null>(null);
  /**
   * Nothing went wrong, the user just walked away from the popup. Kept apart from `error` so an
   * abandoned sign-in isn't dressed up as a failure.
   */
  readonly hint = signal<string | null>(null);

  /** False when the anon key is missing — see the environments. */
  readonly isConfigured = !!environment.AI_LABS.supabaseAnonKey;

  private get window(): Window | null {
    return this.isBrowser ? this.document.defaultView : null;
  }

  /** The stored session, as a comparable string — never `getSession()`, see `awaitSession`. */
  private storedSession(): string | null {
    const stored = this.storage.getLocal<unknown>(environment.AI_LABS.storageKey);
    return stored === null ? null : JSON.stringify(stored);
  }

  /** `@supabase/supabase-js` is dynamically imported so the ~150 kB client stays out of the initial bundle. */
  private async getClient(): Promise<SupabaseClient> {
    if (this.client) return this.client;
    if (this.clientPromise) return this.clientPromise;

    this.clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      this.client = createClient(
        environment.AI_LABS.supabaseUrl,
        environment.AI_LABS.supabaseAnonKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            // The popup — not the opener — is the window that lands on the callback URL carrying
            // the tokens, so only it needs to parse them.
            detectSessionInUrl: true,
            storageKey: environment.AI_LABS.storageKey,
          },
        },
      );
      return this.client;
    });

    return this.clientPromise;
  }

  /**
   * Restore an existing session on page load. Safe to call during SSR — it no-ops on the server,
   * where there's no browser storage to read from.
   */
  async restoreSession(): Promise<void> {
    if (!this.isBrowser || !this.isConfigured) return;
    this.restoring.set(true);
    try {
      // Read before building the client. Constructing it is what attempts the recovery refresh,
      // and a refresh that fails purges the stored session and emits SIGNED_OUT *during*
      // construction — before there is any listener to hear it. Comparing before/after is the
      // only way to catch the commonest expiry of all: coming back to a dead refresh token.
      const storedBefore = this.storedSession();
      const client = await this.getClient();
      const { data } = await client.auth.getSession();
      this.applySession(data.session);
      if (storedBefore && !data.session) {
        this.error.set('Your AI Labs session expired. Please sign in again.');
      }
      // Bind once. This runs on every visit to an AI Labs page and again in the callback popup;
      // without the guard each visit stacked another listener on a client that never unsubscribes.
      if (!this.authListenerBound) {
        this.authListenerBound = true;
        client.auth.onAuthStateChange((event, session) => this.handleAuthChange(event, session));
      }
    } catch (err) {
      this.logger.error('AiLabAuth: session restore failed', err);
    } finally {
      this.restoring.set(false);
    }
  }

  /**
   * Token expiry is supabase-js's job — `autoRefreshToken` renews in the background and reports the
   * outcome here. A refresh that fails (revoked or expired refresh token) arrives as `SIGNED_OUT`,
   * indistinguishable from the user pressing Log out except by `userSignedOut`. Without that
   * distinction the page silently reverts to logged-out and the user is left guessing.
   */
  private handleAuthChange(event: AuthChangeEvent, session: Session | null): void {
    if (event === 'SIGNED_OUT') {
      this.applySession(null);
      if (!this.userSignedOut) {
        this.error.set('Your AI Labs session expired. Please sign in again.');
      }
      this.userSignedOut = false;
      return;
    }
    this.applySession(session);
  }

  /** The one write point for every piece of state derived from a session. */
  private applySession(session: Session | null): void {
    this.isSignedIn.set(!!session);
    // Entra doesn't always populate the top-level claim — depending on how the tenant maps
    // attributes the address arrives in `user_metadata` instead. Null is tolerated: it costs the
    // label and the silent re-auth hint, never the ability to log out.
    const meta = session?.user?.user_metadata as { email?: string } | undefined;
    const email = session?.user?.email ?? meta?.email ?? null;
    this.identity.set(email);
    if (!session) return;
    this.error.set(null);
    this.hint.set(null);
    if (email) this.storage.setLocal(AI_LAB_LAST_EMAIL_KEY, email);
  }

  /**
   * Open the Entra sign-in popup. Resolves once a session lands or the popup closes without one.
   *
   * MUST be called straight from a click handler: the blank popup is opened synchronously before any
   * `await`, because a `window.open` that happens after an await has lost the user-gesture context
   * and gets blocked.
   */
  async signIn(opts?: { switchAccount?: boolean }): Promise<void> {
    if (!this.isBrowser) return;
    // Don't block on `signingIn`: a user who closes the popup without signing in leaves a wait we
    // cannot observe (COOP hides `popup.closed`), so a second click must be able to supersede it
    // rather than hit a dead button.
    this.abortWait?.();
    const attempt = ++this.attempt;
    this.error.set(null);
    this.hint.set(null);

    if (!this.isConfigured) {
      this.error.set('Sign-in is not configured yet.');
      this.logger.error('AiLabAuth: AI_LABS.supabaseAnonKey is empty');
      return;
    }

    const popup = this.openCenteredPopup();
    if (!popup) {
      this.error.set('Please allow pop-ups for this site to sign in.');
      return;
    }

    this.signingIn.set(true);
    try {
      const client = await this.getClient();
      const lastEmail = opts?.switchAccount
        ? null
        : this.storage.getLocal<string>(AI_LAB_LAST_EMAIL_KEY);
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'openid profile email',
          redirectTo: `${environment.SITE_URL}${environment.AI_LABS.redirectPath}`,
          // Hand back the URL instead of navigating this tab.
          skipBrowserRedirect: true,
          queryParams: {
            // A known account plus a live Entra session round-trips with no UI at all. Only ask
            // which account when we have no idea which one to use, or the user said to change it —
            // otherwise `select_account` makes every repeat sign-in a picker for their one account.
            ...(lastEmail ? { login_hint: lastEmail } : { prompt: 'select_account' }),
            // Pin the lab tenant's domain so learners can't land on the generic consumer sign-in
            // screen. Must be the tenant that owns the app registration Supabase's Azure provider
            // uses.
            domain_hint: environment.AI_LABS.domainHint,
          },
        },
      });

      if (error || !data?.url) {
        throw error ?? new Error('No authorization URL returned');
      }

      // Readable here and nowhere later: the popup is still `about:blank`, so COOP has not severed
      // the handle yet. Closing it during the round-trip above is a cancel, not a failure.
      if (popup.closed) {
        this.hint.set('Sign-in window was closed. Click to try again.');
        return;
      }

      popup.location.href = data.url;
      await this.awaitSession(client, popup);
    } catch (err) {
      this.logger.error('AiLabAuth: sign-in failed', err);
      this.error.set('Sign-in failed. Please try again.');
      popup.close();
    } finally {
      // A superseded attempt must not clear the flag out from under the new one.
      if (attempt === this.attempt) this.signingIn.set(false);
    }
  }

  /** Opens Copilot Studio in a new tab, as the account just signed in. */
  launchCopilot(): void {
    this.window?.open(COPILOT_STUDIO_URL, '_blank', 'noopener,noreferrer');
  }

  /** Whether this browser is holding a labs session at all. */
  hasStoredSession(): boolean {
    return this.isBrowser && this.storedSession() !== null;
  }

  /**
   * The synchronous half of logging out: drop what this browser is holding.
   *
   * Deliberately does not touch the supabase client — building it pulls a ~150 kB dynamic import,
   * and a Miles logout hard-navigates as soon as it returns, which kills anything still in flight.
   * Removing the two storage keys by hand is what actually makes the next page load signed out.
   *
   * The stored email goes with the session: logging out is how a user says "not this account", so
   * the next sign-in has to show the picker again. Above the `isConfigured` guard on purpose — a
   * misconfigured env must still be able to clear a session a correctly-configured one wrote.
   */
  clearLocalSession(): void {
    if (!this.isBrowser) return;
    clearAiLabSession(this.storage);
    this.applySession(null);
  }

  /** Local teardown first, server revoke second — see `clearLocalSession`. */
  async signOut(): Promise<void> {
    if (!this.isBrowser) return;
    // Read before clearing: `clearLocalSession` is what makes both false.
    const hadSession = this.isSignedIn() || this.hasStoredSession();
    this.clearLocalSession();
    if (!this.isConfigured || !hadSession) return;

    // Only latched once we know the client will be built and will emit SIGNED_OUT —
    // `handleAuthChange` is the only thing that consumes the flag, so setting it on a path that never
    // reaches supabase would mute the next genuine expiry instead of this deliberate log-out.
    this.userSignedOut = true;
    try {
      const client = await this.getClient();
      await client.auth.signOut();
    } catch (err) {
      this.logger.error('AiLabAuth: sign-out failed', err);
      // Never leave the flag set — it would mute the next genuine expiry.
      this.userSignedOut = false;
    }
  }

  /**
   * Log-out for "the user left the platform entirely": this session, plus the Entra session at
   * Microsoft. Clearing the Supabase session alone does not log anyone out of the lab — the Copilot
   * Studio hand-off rides the Microsoft cookie, and only Microsoft can drop that.
   *
   * Capped rather than awaited outright, so neither half can hold up the navigation the caller is
   * about to make. The local teardown inside `signOut` is synchronous and has already landed by the
   * time we start waiting.
   */
  async signOutEverywhere(): Promise<void> {
    if (!this.isBrowser) return;
    const hadSession = this.isSignedIn() || this.hasStoredSession();
    const teardown = Promise.all([
      this.signOut(),
      hadSession ? this.entraLogout() : Promise.resolve(),
    ]);
    await Promise.race([
      teardown,
      new Promise<void>((resolve) => setTimeout(resolve, LOGOUT_TIMEOUT_MS)),
    ]);
  }

  /**
   * Front-channel Entra sign-out, in a hidden iframe.
   *
   * ponytail: best-effort. It is a no-op where third-party cookies are partitioned (Safari ITP,
   * Chrome's 3P-cookie restrictions), and it cannot reach a Copilot Studio tab the user already has
   * open. The local teardown is unaffected either way. If a guaranteed Entra sign-out is ever
   * required, swap this for a visible popup, which costs a user gesture.
   */
  private entraLogout(): Promise<void> {
    return new Promise((resolve) => {
      const frame = this.document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.display = 'none';

      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        frame.remove();
        resolve();
      };
      // Declared after `finish` closes over it; both callers run a tick later.
      const deadline = setTimeout(finish, LOGOUT_TIMEOUT_MS);

      frame.addEventListener('load', finish);
      frame.src = `https://login.microsoftonline.com/${environment.AI_LABS.tenantId}/oauth2/v2.0/logout`;
      this.document.body.appendChild(frame);
    });
  }

  /**
   * Wait until the popup reports back, a session appears, or we give up.
   *
   * Deliberately does NOT test `popup.closed`: COOP severs the opener↔popup link on the hop to
   * Microsoft, after which `.closed` is permanently `true`, so testing it aborted the flow on the
   * first tick — while the user was still on the login screen.
   *
   * Two signals, both opener-independent:
   *  - the callback page's BroadcastChannel message (fast path), and
   *  - polling the stored session, which the popup writes to same-origin browser storage. Polling
   *    rather than `onAuthStateChange` because browsers don't fire `storage` consistently for
   *    script-opened windows.
   *
   * A third signal, focus returning to this window, ends the *spinner* but deliberately not the
   * *wait*. Focus can't tell "closed the popup" from "alt-tabbed back for a moment", so it drops the
   * loading state and offers a retry, while every real settle path stays armed — a user who returns
   * to the popup and finishes still lands signed in and the hint clears itself.
   */
  private awaitSession(client: SupabaseClient, popup: Window): Promise<void> {
    const win = this.window;
    return new Promise((resolve) => {
      const channel = new BroadcastChannel(AI_LAB_CHANNEL);
      let settled = false;
      let grace: ReturnType<typeof setTimeout> | null = null;

      // A synchronous storage read, NEVER `getSession()`: that acquires the Web Lock
      // `lock:<storageKey>`, held by the popup for its whole code-for-session exchange, so polling it
      // stacked lock waiters until they all resumed at once and froze the page. Compared against the
      // value at open time so a signed-in user switching accounts isn't settled on their old
      // session at the first tick. `finish` does the one authoritative read.
      const sessionAtOpen = this.storedSession();
      const timer = setInterval(() => {
        const stored = this.storedSession();
        if (stored && stored !== sessionAtOpen) void finish();
      }, POLL_MS);
      const deadline = setTimeout(() => void finish(), SIGN_IN_TIMEOUT_MS);

      const onFocus = (): void => {
        if (settled || grace) return;
        grace = setTimeout(() => {
          grace = null;
          if (settled) return;
          this.signingIn.set(false);
          this.hint.set('Sign-in window closed. Click to try again.');
        }, RETURN_GRACE_MS);
      };
      win?.addEventListener('focus', onFocus);

      const finish = async (): Promise<void> => {
        if (settled) return;
        settled = true;
        this.abortWait = null;
        clearInterval(timer);
        clearTimeout(deadline);
        if (grace) clearTimeout(grace);
        win?.removeEventListener('focus', onFocus);
        channel.close();
        // Re-read rather than trust the signal: this is also the "gave up" and "callback finished
        // without a session" path, which must land on false.
        const { data } = await client.auth.getSession();
        this.applySession(data.session);
        // No-op once COOP has severed the handle — the callback self-closes.
        popup.close();
        resolve();
      };

      channel.onmessage = (event: MessageEvent) => {
        const data = String(event.data);
        if (!data.startsWith(AI_LAB_CALLBACK_DONE)) return;
        // `DONE:<reason>` — the provider refused. Set before `finish`, which lands on a null session
        // and deliberately leaves `error` alone.
        const reason = data.slice(AI_LAB_CALLBACK_DONE.length + 1);
        if (reason) {
          this.error.set(`Sign-in failed: ${reason}`);
          this.logger.error('AiLabAuth: provider returned an error', reason);
        }
        void finish();
      };
      this.abortWait = () => void finish();
    });
  }

  /** Centred on the window the user is actually looking at, not screen 0. */
  private openCenteredPopup(): Window | null {
    const win = this.window;
    if (!win) return null;
    const left = win.screenX + (win.outerWidth - POPUP_WIDTH) / 2;
    const top = win.screenY + (win.outerHeight - POPUP_HEIGHT) / 2;
    return win.open(
      '',
      'ai-lab-signin',
      `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable,scrollbars`,
    );
  }
}

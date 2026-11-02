import { HttpContext, httpResource } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { computed, DOCUMENT, effect, inject, PLATFORM_ID, Service, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { CommonResponse, SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { AiLabAuth } from '@core/services/ai-lab-auth/ai-lab-auth';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NotificationService } from '@core/services/notification/notification';
import { AI_LABS_API } from '@features/ai-labs/constants/ai-labs-api';
import { AiLabAccountState, AiLabLabsAccount } from '@features/ai-labs/models/ai-labs.model';

/**
 * Only an https link on a Microsoft host is opened — the URL comes off an API response, and
 * `window.open` would run a `javascript:` one.
 */
function copilotLink(raw: string | null | undefined): string | null {
  try {
    const url = new URL(raw ?? '');
    const microsoft = url.hostname === 'microsoft.com' || url.hostname.endsWith('.microsoft.com');
    return url.protocol === 'https:' && microsoft ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Whose lab this is: the Microsoft account AI Labs built for this learner (`lab_email`) and their
 * own Copilot Studio environment (`environment_url`), off `account-ensure/?include=labs_account`.
 *
 * The lab sign-in (`AiLabAuth`) is a browser-wide Microsoft session with no owner of its own, so
 * this is what ties it to the Miles learner: sign-in is hinted to `lab_email`, a lab session for
 * anyone else is dropped as soon as both are known, and Launch is checked again at the click.
 *
 * Launch can't choose Copilot Studio's account — Copilot Studio reuses whichever Microsoft account
 * last used it on this browser and reads no account hint from its link (checked against its shell,
 * 2026-10-27). Opening the learner's own environment makes a wrong account show as "no access"
 * rather than as someone else's workspace; the pages say which account to look for.
 *
 * Route-scoped (`autoProvided: false`, on both AI Labs routes). The `include` read calls AI Labs,
 * so it is quiet and browser only, once per page.
 */
@Service({ autoProvided: false })
export class AiLabAccount {
  private readonly auth = inject(AuthSession);
  private readonly labAuth = inject(AiLabAuth);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly accountRes = httpResource<AiLabLabsAccount | null>(
    () =>
      this.isBrowser && this.auth.isAuthenticated()
        ? {
            url: apiUrl(AI_LABS_API.accountEnsure),
            params: { include: 'labs_account' },
            context: new HttpContext().set(SKIP_LOADING, true).set(SKIP_ERROR_NOTIFICATION, true),
          }
        : undefined,
    {
      defaultValue: null,
      parse: (raw) => (raw as CommonResponse<AiLabAccountState> | null)?.data?.labs_account ?? null,
    },
  );

  private readonly account = computed(() =>
    this.accountRes.hasValue() ? this.accountRes.value() : null,
  );

  /** The Microsoft account this learner's lab belongs to; `null` until known. */
  readonly labEmail = computed(() => this.account()?.lab_email?.trim() || null);
  /** The learner's own Copilot Studio environment, if AI Labs sent a usable one. */
  readonly environmentUrl = computed(() => copilotLink(this.account()?.environment_url));
  readonly isLoading = computed(() => this.accountRes.isLoading());

  /**
   * Whether the Microsoft side is built. `null` while unknown — no answer yet, or AI Labs couldn't
   * be asked (`labs_account` absent) — so callers fall back to `account_created`.
   */
  readonly provisioned = computed(() => this.account()?.provisioned ?? null);

  /**
   * The lab account is built but this Miles login predates it: AI Labs reads the entitlement off
   * the login token, so agents, flows and submit refuse it until a fresh login.
   */
  readonly needsRelogin = computed(
    () => this.account()?.provisioned === true && this.account()?.entitled === false,
  );

  constructor() {
    // A lab session for anyone but this learner — left by a previous person on this browser, or
    // picked in the popup — goes the moment both are known.
    effect(() => {
      const labEmail = this.labEmail();
      if (!labEmail || !this.labAuth.isSignedIn() || this.labAuth.restoring()) return;
      untracked(() => {
        if (!this.labAuth.belongsTo(labEmail)) void this.labAuth.dropForeignSession(labEmail);
      });
    });
  }

  /** Re-read the account — the landing's set-up poll, until it is built. */
  reload(): void {
    this.accountRes.reload();
  }

  /** The fresh login `needsRelogin` asks for: sign out, sign in, and come back to this page. */
  async relogin(): Promise<void> {
    const redirect = this.router.url;
    await this.auth.logout();
    await this.router.navigate(['/auth/login'], { queryParams: { redirect } });
  }

  /** The Microsoft sign-in, hinted to this learner's lab account. Straight from a click. */
  signIn(opts?: { switchAccount?: boolean }): Promise<void> {
    return this.labAuth.signIn({ ...opts, labEmail: this.labEmail() });
  }

  /**
   * Copilot Studio, only as this learner's lab account and into their own environment. Not knowing
   * the account yet is not a pass — the click re-reads it and asks for another. Synchronous, so the
   * tab still opens inside the click.
   */
  launch(): void {
    const labEmail = this.labEmail();
    if (!labEmail) {
      this.notification.info('One moment', 'Checking your AI Lab account — click again shortly.');
      if (!this.isLoading()) this.accountRes.reload();
      return;
    }
    if (!this.labAuth.belongsTo(labEmail)) {
      void this.labAuth.dropForeignSession(labEmail);
      return;
    }
    this.labAuth.launchCopilot(this.environmentUrl());
  }

  /** The lab link on the clipboard, for a private window when Copilot Studio shows another account. */
  async copyLabLink(): Promise<void> {
    const link = this.environmentUrl();
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (!link || !clipboard) return;
    try {
      await clipboard.writeText(link);
      this.notification.success('Link copied', 'Paste it into a private window to sign in fresh.');
    } catch {
      this.notification.error("Couldn't copy the link", link);
    }
  }
}

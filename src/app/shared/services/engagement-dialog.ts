import {
  DestroyRef,
  Service,
  Injector,
  PLATFORM_ID,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, Observable, filter, firstValueFrom, from, map, switchMap } from 'rxjs';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Storage } from '@core/services/storage/storage';
import { CurrentPlanData } from '@core/models/payment.model';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { offeringTypeFromUrl } from '@core/utils/offering-type';
import {
  ProfileCompletionDialog,
  ProfileCompletionDialogResult,
} from '@shared/dialogs/profile-completion-dialog/profile-completion-dialog';
import { SUBSCRIPTION_DIALOG } from '@core/services/dialog/feature-dialog-tokens';
import { AiLabDialog } from '@shared/dialogs/ai-lab-dialog/ai-lab-dialog';

type DialogKind = 'aiLab' | 'profile' | 'subscription';

/** Priority order — `resolveNext` returns the first eligible entry. */
const DIALOG_KINDS = ['aiLab', 'profile', 'subscription'] as const satisfies readonly DialogKind[];

/** Admin panel. Root-mounted, so this stays anchored. */
const ADMIN_ROUTE = /^\/admin(\/|\?|$)/;

/**
 * Checkout. Payment is mounted *under* the `/:country/:profession_type` prefix
 * — `/us/accounting/payment/cart` — so this matches `payment` as a whole path
 * segment anywhere rather than anchoring at the root. Anchoring is what made
 * the previous guard silently never fire. Requiring a full segment keeps it off
 * slugs like `/masterclass/payment-fraud`.
 */
const PAYMENT_ROUTE = /\/payment(\/|\?|$)/;

/**
 * Immersive, auth-gated feature experiences — AI Labs and the MilesVerse
 * simulations. Both mount under the `/:country/:profession_type` prefix
 * (`/us/accounting/ai-labs`, `/us/accounting/simulation/...`), so this matches
 * either as a whole path segment anywhere rather than anchoring at the root.
 * A learner steps into these deliberately; a profile/subscription/announcement
 * pop-up over them breaks the flow (and the AI Labs announcement over the AI
 * Labs page is doubly pointless).
 */
const IMMERSIVE_ROUTE = /\/(ai-labs|simulation)(\/|\?|$)/;

/**
 * Auth module — login, signup, forgot-password, the AI Labs OAuth callback.
 * Root-mounted (`/auth/...`), so this stays anchored.
 */
const AUTH_ROUTE = /^\/auth(\/|\?|$)/;

/**
 * In-course learning steps: the chapter player, the final-assessment exam and
 * its report, and the post-course feedback form. All mount under
 * `/:country/:profession_type/<offering>/:courseId/:courseTitle/...`, so these
 * match as whole path segments anywhere rather than anchoring at the root.
 * A pop-up mid-chapter, mid-exam or mid-feedback interrupts a timed, one-shot
 * flow. Skipped (not dismissed) so the next tick after leaving evaluates
 * normally.
 */
const LEARNING_ROUTE = /\/(chapter|final-assessment|feedback)(\/|\?|$)/;

const DISMISSAL_KEYS: Record<DialogKind, string> = {
  aiLab: 'engagement.dismissed.aiLab',
  profile: 'engagement.dismissed.profile',
  subscription: 'engagement.dismissed.subscription',
};

/**
 * Drives a single 20-second polling stream that surfaces follow-up dialogs to
 * authenticated users: first the profile-completion dialog (sector + job_role),
 * then the subscription dialog when no active plan is present.
 *
 * Once-per-session dismissal: a dialog is marked dismissed the moment it
 * opens, so it surfaces *at most once per browser-tab session*. The flag is
 * persisted in `sessionStorage`, so a page refresh inside the same tab keeps
 * it suppressed; opening a new tab or closing/reopening the browser counts as
 * a new session. Flags are cleared on logout (`isAuthenticated` flipping
 * `true → false`) and re-armed on the next fresh login.
 *
 * Browser-only — the stream never starts during SSR.
 */
@Service()
export class EngagementDialog {
  private readonly dialogs = inject(NgpDialogManager);
  private readonly router = inject(Router);
  private readonly feature = inject(FeatureFacade);
  private readonly storage = inject(Storage);
  private readonly injector = inject(Injector);
  private readonly subscriptionDialog = inject(SUBSCRIPTION_DIALOG);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Default to `false` so the SSR path is deterministic. The real value is
  // hydrated from sessionStorage inside `start()` — that way the storage read
  // doesn't depend on field-declaration order and stays inside the
  // browser-gated codepath. Keyed by kind so adding a dialog can't leave a
  // per-kind branch behind.
  private readonly dismissed: Record<DialogKind, WritableSignal<boolean>> = {
    aiLab: signal(false),
    profile: signal(false),
    subscription: signal(false),
  };

  /**
   * The engagement dialog *we* currently have open, if any. Tracked so a
   * navigation into a suppressed route can close it without touching dialogs
   * opened by anything else (`Dialog.closeAll()` would).
   */
  private openRef: { close(): unknown } | null = null;

  private started = false;

  start(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    // Hydrate dismissal flags from sessionStorage so a refresh in the same
    // tab keeps the previously-shown dialog suppressed. `Storage.getSession`
    // is SSR-safe, but we only reach here on the browser path anyway.
    for (const kind of DIALOG_KINDS) {
      this.dismissed[kind].set(this.readDismissal(kind));
    }

    // Gating at open-time isn't enough: a dialog opened on an allowed page
    // stays on screen when the router moves onto a suppressed one (nothing in
    // `Dialog` closes on navigation), which is what put the AI Labs
    // announcement over `/auth/profile`. Close ours on the way in.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map((e) => e.urlAfterRedirects),
        filter((url) => this.isSuppressed(url)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.openRef?.close());

    // ponytail: the polling loop was driven by `auth.isAuthenticated` and
    // every dialog it opens is a nudge aimed at a signed-in user, so with the
    // auth layer gone there is nothing to poll for. Re-wire by restarting the
    // timer from a session signal and restoring `resolveNext()`.
  }

  /**
   * Pick the next eligible dialog, highest priority first. AI Labs is the
   * feature-launch announcement and runs ahead of everything; then profile,
   * because fixing the profile improves the data backing the upsell that
   * follows; then the subscription upsell.
   */
  resolveNext(): DialogKind | null {
    // Skipped, not dismissed: the next tick after leaving a suppressed route
    // evaluates normally.
    if (this.isSuppressed(this.router.url)) return null;

    // ponytail: every branch below keyed off the signed-in user's profile and
    // plan. No session layer, no user, nothing to resolve.
    return null;
  }

  /**
   * Routes no engagement dialog may sit on: the admin panel, checkout, the
   * immersive AI Labs / simulation experiences, the auth pages (login, signup,
   * forgot-password, profile) and the in-course chapter / assessment /
   * feedback steps. Used both to decide whether to open and to close one we
   * already opened when the router moves onto such a route.
   */
  isSuppressed(url: string): boolean {
    return (
      ADMIN_ROUTE.test(url) ||
      PAYMENT_ROUTE.test(url) ||
      IMMERSIVE_ROUTE.test(url) ||
      AUTH_ROUTE.test(url) ||
      LEARNING_ROUTE.test(url)
    );
  }

  private hasActiveSubscription(plan: CurrentPlanData | null): boolean {
    return !!plan && plan.subscription_status?.toLowerCase() === 'active';
  }

  private openDialog$(kind: DialogKind): Observable<unknown> {
    if (kind === 'aiLab') {
      // Purely an announcement — nothing to re-validate against the server, so
      // mark dismissed at open-time like `profile`. Freely dismissible: the CTA
      // navigates, and every other exit is a no-op for this session.
      this.markDismissed('aiLab');
      const ref = this.dialogs.open<void, void>(AiLabDialog, { injector: this.injector });
      return from(this.afterClosed(ref, ref.afterClosed)).pipe(switchMap(() => EMPTY));
    }

    if (kind === 'profile') {
      // Mark dismissed at open-time and persist to sessionStorage. This
      // survives a page refresh in the same tab, and prevents a stale
      // `fetchMyProfile` (or a save that doesn't reflect immediately) from
      // re-triggering the dialog on the next 20s tick.
      this.markDismissed('profile');
      // Sector + job_role are not skippable: the dialog's shell is not dismissible, so
      // the only way out is a successful Save (it also omits the close + skip buttons).
      const ref = this.dialogs.open<void, ProfileCompletionDialogResult>(ProfileCompletionDialog, {
        injector: this.injector,
      });
      return from(this.afterClosed(ref, ref.afterClosed)).pipe(
        switchMap((result) => {
          if (result?.saved) {
            this.feature.refreshPersonalized(offeringTypeFromUrl(this.router.url));
          }
          return EMPTY;
        }),
      );
    }

    // Subscription: re-validate against the SERVER right before opening. The
    // cached `currentPlan` signal can be stale — e.g. the user purchased a
    // plan in another tab, or `fetchMyProfile` ran before the backend had
    // committed the new subscription. Without this, the popup can flash up
    // on a user who already has an active plan. We only mark dismissed once
    // we actually open, so a "refreshed-into-active" outcome leaves the
    // session-flag clear for the next legitimate tick to evaluate again.
    // ponytail: the server re-validation used the removed session service, so
    // the upsell opens straight away when something asks for it.
    this.markDismissed('subscription');
    // The dialog lives in `features/payment` and is resolved through
    // `SUBSCRIPTION_DIALOG`, so opening it is now async; the returned stream is
    // unchanged — it still completes when the dialog closes.
    return from(
      this.subscriptionDialog().then((SubscriptionDialog) => {
        const ref = this.dialogs.open<void, void>(SubscriptionDialog, { injector: this.injector });
        return this.afterClosed(ref, ref.afterClosed);
      }),
    ).pipe(switchMap(() => EMPTY));
  }

  /**
   * Per-kind dismissal accessors — exposed for unit tests that exercise the
   * decision matrix without spinning up the timer.
   */
  isDismissed(kind: DialogKind): boolean {
    return this.dismissed[kind]();
  }

  private readDismissal(kind: DialogKind): boolean {
    return this.storage.getSession<boolean>(DISMISSAL_KEYS[kind]) === true;
  }

  markDismissed(kind: DialogKind): void {
    this.dismissed[kind].set(true);
    this.storage.setSession(DISMISSAL_KEYS[kind], true);
  }

  /**
   * Resolves when the dialog closes, with its result. The closed stream emits once and
   * completes; `firstValueFrom` resolves to the emitted value, or to `undefined` if it
   * completes without one, and tears down the subscription either way.
   */
  private afterClosed<R>(
    ref: { close(): unknown },
    closed$: Observable<R | undefined>,
  ): Promise<R | undefined> {
    // Track it while it's up so a navigation into a suppressed route can close
    // it, and clear the handle once it's gone.
    this.openRef = ref;
    return firstValueFrom(closed$, { defaultValue: undefined }).finally(() => {
      this.openRef = null;
    });
  }
}

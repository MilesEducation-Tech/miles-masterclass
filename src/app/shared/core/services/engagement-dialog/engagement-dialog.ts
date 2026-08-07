import {
  DestroyRef,
  effect,
  inject,
  Injector,
  PLATFORM_ID,
  Service,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, Observable, concatMap, filter, firstValueFrom, from, switchMap, timer } from 'rxjs';
import { Auth } from '../auth/auth';
import { Dialog, DialogRef } from '../dialog/dialog';
import { Storage } from '../storage/storage';
import { offeringTypeFromUrl } from '../../../utils/offering-type';
import {
  ProfileCompletionDialog,
  ProfileCompletionDialogResult,
} from '../../../components/dialog/profile-completion-dialog/profile-completion-dialog';
import { SubscriptionDialog } from '../../../components/dialog/subscription-dialog/subscription-dialog';
import { AiLabDialog } from '../../../components/dialog/ai-lab-dialog/ai-lab-dialog';

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

const INTERVAL_MS = 20_000;
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
  private readonly auth = inject(Auth);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  // ponytail: FeatureFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly feature: any = {
    refreshPersonalized: (..._args: any[]): any => null,
  };
  private readonly storage = inject(Storage);
  private readonly injector = inject(Injector);
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

    // Clear persisted dismissal flags on logout so the next user (or the
    // same user logging back in) gets a fresh evaluation. Reset happens on
    // the `true → false` edge to keep storage clean during the brief window
    // before the next login fires.
    let wasAuthed = this.auth.isAuthenticated();
    effect(
      () => {
        const authed = this.auth.isAuthenticated();
        if (wasAuthed && !authed) {
          untracked(() => {
            for (const kind of DIALOG_KINDS) {
              this.dismissed[kind].set(false);
              this.storage.removeSession(DISMISSAL_KEYS[kind]);
            }
          });
        }
        wasAuthed = authed;
      },
      { injector: this.injector },
    );

    toObservable(this.auth.isAuthenticated, { injector: this.injector })
      .pipe(
        switchMap((authed) => (authed ? timer(INTERVAL_MS, INTERVAL_MS) : EMPTY)),
        filter(() => this.dialog.getOpenDialogCount() === 0),
        concatMap(() => {
          const kind = this.resolveNext();
          return kind ? this.openDialog$(kind) : EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Pick the next eligible dialog, highest priority first. AI Labs is the
   * feature-launch announcement and runs ahead of everything; then profile,
   * because fixing the profile improves the data backing the upsell that
   * follows; then the subscription upsell.
   */
  resolveNext(): DialogKind | null {
    // Never interrupt the admin panel with learner-facing engagement dialogs.
    if (ADMIN_ROUTE.test(this.router.url)) return null;

    const user = this.auth.currentUser();
    if (!user) return null;

    // Feature launch — shown to every authenticated user once per session, so
    // it deliberately has no `is_existing_user` gate like the two below.
    if (!this.isDismissed('aiLab')) {
      return 'aiLab';
    }

    // Profile and subscription stay out of checkout. Not dismissed, just
    // skipped: the next tick after leaving /payment evaluates normally.
    if (PAYMENT_ROUTE.test(this.router.url)) return null;

    // ponytail: the profile nudge used to fire on a missing `sector`/`job_role`,
    // both of which came from reference-data endpoints CAIRA does not have. It
    // now nudges on the completeness CAIRA *can* report — first name, full name
    // and email, from v2/status. `is_existing_user` is gone with the same model,
    // so the "don't nag a brand-new signup" guard is now the completeness check
    // itself.
    if (!this.auth.isProfileComplete() && !this.isDismissed('profile')) {
      return 'profile';
    }
    if (
      !this.hasActiveSubscription(this.auth.currentPlan()) &&
      !this.isDismissed('subscription') &&
      this.auth.isProfileComplete()
    ) {
      return 'subscription';
    }
    return null;
  }

  private hasActiveSubscription(plan: any | null): boolean {
    return !!plan && plan.subscription_status?.toLowerCase() === 'active';
  }

  private openDialog$(kind: DialogKind): Observable<unknown> {
    if (kind === 'aiLab') {
      // Purely an announcement — nothing to re-validate against the server, so
      // mark dismissed at open-time like `profile`. Freely dismissible: the CTA
      // navigates, and every other exit is a no-op for this session.
      this.markDismissed('aiLab');
      const ref = this.dialog.open<AiLabDialog, void>(AiLabDialog, {
        maxWidth: '95vw',
        ariaLabel: 'Miles AI Labs is here',
        injector: this.injector,
        // The container is `rounded-lg ... overflow-auto` with a `bg-dialog`
        // fill, which squares off the card's 24px corners. `panelClass` is
        // concatenated onto that string with no tailwind-merge, so these need
        // `!` to beat the base utilities rather than lose on emission order.
        panelClass: 'rounded-[24px]! overflow-hidden!',
      });
      return from(this.afterClosed(ref)).pipe(switchMap(() => EMPTY));
    }

    if (kind === 'profile') {
      // Mark dismissed at open-time and persist to sessionStorage. This
      // survives a page refresh in the same tab, and prevents a stale
      // `fetchMyProfile` (or a save that doesn't reflect immediately) from
      // re-triggering the dialog on the next 20s tick.
      this.markDismissed('profile');
      const ref = this.dialog.open<ProfileCompletionDialog, ProfileCompletionDialogResult>(
        ProfileCompletionDialog,
        {
          maxWidth: '95vw',
          ariaLabel: 'Complete your profile',
          injector: this.injector,
          // Sector + job_role are not skippable — block Escape and backdrop
          // clicks so the only way out is a successful Save (the dialog itself
          // omits the close + skip buttons).
          disableClose: true,
        },
      );
      return from(this.afterClosed(ref)).pipe(
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
    return this.auth.fetchCurrentPlan().pipe(
      switchMap((plan) => {
        if (this.hasActiveSubscription(plan)) return EMPTY;
        this.markDismissed('subscription');
        const ref = this.dialog.open<SubscriptionDialog, void>(SubscriptionDialog, {
          maxWidth: '95vw',
          ariaLabel: 'Subscribe to a plan',
          injector: this.injector,
        });
        return from(this.afterClosed(ref)).pipe(switchMap(() => EMPTY));
      }),
    );
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
   * `DialogRef.afterClosed$` is a Subject that emits once and completes (see
   * `Dialog.close()`). `firstValueFrom` resolves to the emitted value or to
   * `undefined` if it completes without one — and tears down the underlying
   * subscription either way.
   */
  private afterClosed<R>(ref: DialogRef<unknown, R>): Promise<R | undefined> {
    return firstValueFrom(ref.afterClosed$, { defaultValue: undefined });
  }
}

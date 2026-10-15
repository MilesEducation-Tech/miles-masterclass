import { httpResource } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
} from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Observable, filter, firstValueFrom, from, map, of, switchMap, tap } from 'rxjs';

import {
  ACCOUNT_ROUTES,
  AnswerMap,
  ProfileForm,
  Question,
  QuestionsResponse,
  SaveAnswersResponse,
  readAccountError,
} from '@core/models/account.model';
import { CommonResponse } from '@core/models/http.model';
import { AccountApi } from '@core/services/account-api/account-api';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
// Type-only: the dialog loads with `import()` when the leave guard fires (§4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';

/**
 * A router event after which no redirect of the navigation is still to come: it landed, failed, was skipped, or was
 * cancelled for a reason other than a redirect or a newer navigation.
 */
function settlesNavigation(event: unknown): boolean {
  if (event instanceof NavigationCancel) {
    return (
      event.code !== NavigationCancellationCode.Redirect &&
      event.code !== NavigationCancellationCode.SupersededByNewNavigation
    );
  }
  return (
    event instanceof NavigationEnd ||
    event instanceof NavigationError ||
    event instanceof NavigationSkipped
  );
}

/**
 * The profile / onboarding questionnaire page: which questionnaire, its questions, the save and everything that
 * follows it (milestones, token refresh, redirect, toasts, field errors), and the leave dialog. The page keeps the
 * signal form and its gating; this owns the data and the decisions.
 *
 * Provided by the `Profile` component, not the route. The router keeps a route's injector after you leave
 * (`withAutoCleanupInjectors` is not enabled), and this state must start fresh on every visit: a learner who
 * finishes onboarding and comes back to edit gets the profile questionnaire, not a stale onboarding one.
 *
 * `questions/` says what to render. `GET profile/` (the saved answers) is deliberately NOT read — product decision
 * 2026-10-10: the form is pre-filled from `user-details/` alone, which carries the name and nothing else, so a saved
 * answer does not show when the learner comes back. `PATCH profile/` is the only write.
 *
 * Same three resource rules as `AccountApi` — gate on the boolean, never set the bearer here, `undefined` means idle.
 */
@Service({ autoProvided: false })
export class ProfileFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthSession);
  private readonly account = inject(AccountApi);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly dialogs = inject(NgpDialogManager);
  // Synchronous: the auth route's resolver merged the `auth.*` dictionary before this page rendered.
  private readonly transloco = inject(TranslocoService);
  private readonly t = (key: string, params?: Record<string, unknown>): string =>
    this.transloco.translate(key, params);

  /**
   * Which questionnaire this visit fills. A first-time learner is filling the onboarding questionnaire; everyone
   * else is editing their profile. The two are different question sets.
   *
   * Fixed for the visit: a completed onboarding moves the milestone before the redirect, and the page must not
   * swap to the profile questions underneath the learner.
   */
  private readonly form: ProfileForm = this.auth.needsOnboarding() ? 'onboarding' : 'profile';
  readonly isOnboarding = this.form === 'onboarding';

  private readonly questionsResource = httpResource(
    () =>
      this.auth.isAuthenticated()
        ? { url: apiUrl(ACCOUNT_ROUTES.questions.path), params: { form: this.form } }
        : undefined,
    { parse: (raw) => (raw as CommonResponse<QuestionsResponse>).data },
  );

  /**
   * Already sorted by `display_order` server-side; no client ordering. `hasValue()` first: reading `value()` on a
   * resource in its error state throws.
   */
  readonly questions = computed<Question[]>(() =>
    this.questionsResource.hasValue() ? (this.questionsResource.value()?.Questions ?? []) : [],
  );

  /** The user record. It only seeds the name, so it is not part of `loadError`. */
  readonly user = computed(() => (this.account.user.hasValue() ? this.account.user.value() : null));

  readonly isLoading = computed(
    () => this.questionsResource.isLoading() || this.account.user.isLoading(),
  );

  /** The questionnaire must still load and save when the user record fails, so only `questions/` counts. */
  readonly loadError = computed(() => this.questionsResource.error());

  private readonly saving = signal(false);
  readonly isSaving = this.saving.asReadonly();

  /** Per-question messages from a 400, which this API keys by question code. */
  private readonly fieldErrorsByCode = signal<Record<string, string>>({});
  readonly fieldErrors = this.fieldErrorsByCode.asReadonly();

  /**
   * Save the answers and do what a save implies. The caller validates the form and builds the map; a blank is
   * never in it (see the page's `toAnswerMap`).
   */
  async save(answers: AnswerMap): Promise<void> {
    if (this.saving()) return;

    this.saving.set(true);
    this.fieldErrorsByCode.set({});

    try {
      // The ONLY write. The user record's PATCH was deleted; name and every
      // other profile field are answers in this map.
      //
      // `null` is REFUSED by this endpoint rather than read as "clear", so no
      // code is ever sent as null. PATCH is partial by definition: a code left
      // out keeps whatever it had.
      const result = await this.saveAnswers(answers);
      // Name answers may have changed what `user-details/` reports.
      this.account.user.reload();

      // The write always succeeds; the milestone advances only when every
      // required, shown question has an answer. A non-empty `missing` is NOT an
      // error — it is a partial save, which is a supported thing to do.
      if (result.missing.length) {
        const count = result.missing.length;
        this.notify.info(
          this.t('auth.profile.toast.saved'),
          this.t(`auth.profile.toast.stillToAnswer.${count === 1 ? 'one' : 'other'}`, { count }),
        );
        return;
      }

      // The save response carries the milestones, so the gate can move before
      // the user row reloads — otherwise the redirect below races the reload
      // and `onboardingGuard` sends the learner straight back here.
      this.auth.setMilestones(result.is_onboarding_completed, result.is_profile_completed);

      // RULE 5, and the single most common integration bug on this surface:
      // `miles.onboarding_required` is minted INTO the access token, so if the
      // milestone just advanced we must rotate BEFORE navigating. Skipping this
      // re-reads a stale claim and bounces the user straight back into the
      // onboarding they just finished.
      if (result.profile_status !== this.auth.profileStatus()) {
        await this.auth.forceRefresh();
      }

      this.notify.success(this.t('auth.profile.toast.saved'), this.t('auth.profile.toast.updated'));
      // Still `saving` while this navigates, so the leave guard lets the page go.
      if (this.isOnboarding) await this.router.navigateByUrl('/');
    } catch (err) {
      this.applyFieldErrors(err);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Set when the learner confirms leaving, and kept through the redirects that leave causes. "Back to Home" goes to
   * `/`, whose redirect guard starts a second navigation, and that one runs the leave guard again: without this the
   * dialog asked twice. Cleared when the navigation settles anywhere but a redirect, so a leave that ends back on this
   * page (an onboarding learner sent here again by `onboardingGuard`) asks again next time.
   */
  private leaveConfirmed = false;

  constructor() {
    this.router.events
      .pipe(filter(settlesNavigation), takeUntilDestroyed())
      .subscribe(() => (this.leaveConfirmed = false));
  }

  /**
   * Ask before leaving with unsaved answers. Onboarding is the case that matters: several answers typed and then a
   * stray back-navigation loses all of them, and the API has no draft state to recover from — a partial
   * `PATCH profile/` is the only thing that persists.
   */
  confirmLeave(): Observable<boolean> {
    if (this.leaveConfirmed) return of(true);

    const opened = import('@shared/dialogs/utils-dialog/utils-dialog').then(({ UtilsDialog }) =>
      this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
        data: {
          title: this.t('auth.profile.leave.title'),
          content: [{ type: 'text', value: this.t('auth.profile.leave.body') }],
          buttons: [
            {
              label: this.t('auth.profile.leave.keepEditing'),
              variant: 'outline',
              action: 'close',
            },
            {
              label: this.t('auth.profile.leave.confirm'),
              variant: 'destructive',
              action: 'confirm',
            },
          ],
        },
      }),
    );

    return from(opened).pipe(
      switchMap((ref) => ref.afterClosed),
      map((result) => result?.action === 'confirm'),
      tap((confirmed) => (this.leaveConfirmed = confirmed)),
    );
  }

  /**
   * Write answers as a flat map keyed by question code.
   *
   * Partial by definition — a code you omit is left exactly as it was, which is
   * why this is a PATCH and not a PUT. `null` is refused rather than read as
   * "clear". Idempotent, so a retry after a timeout is safe.
   *
   * The write always succeeds; the milestone advances only when every required,
   * shown question of that form has an answer, and a partial save comes back
   * with `missing` naming what is outstanding. A non-empty `missing` is NOT an
   * error.
   */
  private saveAnswers(patch: AnswerMap): Promise<SaveAnswersResponse> {
    return firstValueFrom(
      this.api
        .call(ACCOUNT_ROUTES.saveAnswers, patch, { params: { form: this.form } })
        .pipe(map((res) => res.data)),
    );
  }

  /**
   * A 400 here is keyed by question code, one message per bad answer. Every
   * other body is an envelope (`{status, message}`, `{message, status}`,
   * `{detail}`) and gets a toast — reading those as field errors put them under
   * questions named `status` and `message` that do not exist, so the learner
   * saw nothing at all.
   */
  private applyFieldErrors(err: unknown): void {
    const parsed = readAccountError(err);
    if (parsed.kind === 'fields') {
      this.fieldErrorsByCode.set(parsed.fields);
      // A key no rendered question owns (e.g. a strict-input refusal) has
      // nowhere to show — say it rather than fail silently.
      const shown = new Set(this.questions().map((q) => q.code));
      const orphan = Object.entries(parsed.fields).find(([code]) => !shown.has(code));
      if (!orphan) return;
      this.logger.error('Profile save failed', err);
      this.notify.error(this.t('auth.profile.toast.saveFailed'), orphan[1]);
      return;
    }
    this.logger.error('Profile save failed', err);
    this.notify.error(
      this.t('auth.profile.toast.saveFailed'),
      parsed.message ?? this.t('auth.profile.toast.couldNotSave'),
    );
  }
}

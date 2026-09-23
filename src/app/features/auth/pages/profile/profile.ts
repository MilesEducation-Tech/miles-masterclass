import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';

import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { AriaAutocomplete } from '@shared/ui/aria/aria-autocomplete/aria-autocomplete';
import { AriaMultiselect } from '@shared/ui/aria/aria-multiselect/aria-multiselect';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { AnswerMap, AnswerValue, Question, UserDetailsPatch } from '@core/models/account.model';
import { AccountApi } from '@core/services/account-api/account-api';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { OnboardingApi } from '@core/services/onboarding-api/onboarding-api';
import { NotificationService } from '@core/services/notification/notification';
import { Logger } from '@core/services/logger/logger';
import { Dialog } from '@core/services/dialog/dialog';
import { DialogButton, UtilsDialog } from '@shared/dialogs/utils-dialog/utils-dialog';

/** How a question should be rendered. */
type Control = 'text' | 'number' | 'boolean' | 'single' | 'multi';

/**
 * Profile and onboarding.
 *
 * This page used to be a FIXED form over the old API's reference data —
 * companies, sectors, job roles, state boards, professional courses. None of
 * that exists on the MilesCAIRA Accounts API, which splits the same screen in
 * two:
 *
 *   - `user_details/` — the user row: name, phone, location. Fixed fields.
 *   - `questions/` + `profile/` — a SERVER-DRIVEN questionnaire. The backend
 *     decides which questions exist, in what order, with what options; this
 *     page only renders them. Adding a question is a backend change now, not a
 *     frontend one.
 *
 * `questions/` says what to render and `profile/` says what has been answered;
 * the two join on the question `code`.
 */
@Component({
  selector: 'app-profile',
  imports: [AriaInput, AriaAutocomplete, AriaMultiselect, Button, Spinner],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  host: {
    // Covers a tab close / reload, which the router guard below cannot see.
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class Profile {
  private readonly onboarding = inject(OnboardingApi);
  private readonly account = inject(AccountApi);
  private readonly auth = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly dialog = inject(Dialog);

  readonly isSaving = signal(false);
  /** Per-question messages from a 400, which this API keys by question code. */
  readonly fieldErrors = signal<Record<string, string>>({});

  constructor() {
    // A first-time learner is filling the onboarding questionnaire; everyone
    // else is editing their profile. The two are different question sets.
    this.onboarding.form.set(this.auth.needsOnboarding() ? 'onboarding' : 'profile');
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  readonly isLoading = computed(
    () =>
      this.onboarding.questions.isLoading() ||
      this.onboarding.answers.isLoading() ||
      this.account.user.isLoading(),
  );

  /** `hasValue()` first: reading `value()` on a resource in its error state throws. */
  readonly loadError = computed(
    () =>
      this.onboarding.questions.error() ??
      this.onboarding.answers.error() ??
      this.account.user.error(),
  );

  readonly isOnboarding = computed(() => this.onboarding.form() === 'onboarding');

  // ── The user row ──────────────────────────────────────────────────────────

  private readonly user = computed(() =>
    this.account.user.hasValue() ? this.account.user.value() : null,
  );

  readonly email = computed(() => this.user()?.email ?? '');
  readonly phone = computed(() => {
    const u = this.user();
    if (!u?.phone_number) return '';
    return `${u.country_code ?? ''} ${u.phone_number}`.trim();
  });

  /**
   * Editable identity fields, re-seeded whenever the row reloads but writable
   * in between — `linkedSignal` is exactly that shape, and it means a reload
   * after save does not strand the user's edits.
   */
  readonly firstName = linkedSignal(() => this.user()?.first_name ?? '');
  readonly lastName = linkedSignal(() => this.user()?.last_name ?? '');
  readonly city = linkedSignal(() => this.user()?.city ?? '');
  readonly location = linkedSignal(() => this.user()?.location ?? '');

  // ── The questionnaire ─────────────────────────────────────────────────────

  /** Already sorted by `display_order` server-side; no client ordering. */
  private readonly questions = computed<Question[]>(() =>
    this.onboarding.questions.hasValue()
      ? (this.onboarding.questions.value()?.Questions ?? [])
      : [],
  );

  /**
   * `section` is a label to group by. It does NOT affect ordering and there are
   * no screen buckets, so the groups are built in first-appearance order and
   * the questions inside each keep the order the server sent.
   */
  readonly sections = computed(() => {
    const groups = new Map<string, Question[]>();
    for (const q of this.questions()) {
      const key = q.section ?? '';
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(q);
    }
    return Array.from(groups, ([title, questions]) => ({ title, questions }));
  });

  /**
   * The working answer set: what came back from `profile/`, plus whatever the
   * user has changed since. Re-seeded when the resource reloads.
   */
  private readonly answers = linkedSignal<AnswerMap>(() =>
    this.onboarding.answers.hasValue() ? { ...(this.onboarding.answers.value() ?? {}) } : {},
  );

  answerOf(question: Question): AnswerValue {
    const stored = this.answers()[question.code];
    if (stored !== undefined) return stored;
    // An unanswered question needs a value of the right SHAPE, or a multiselect
    // bound to `undefined` renders nothing and a checkbox renders indeterminate.
    switch (this.controlOf(question)) {
      case 'multi':
        return [];
      case 'boolean':
        return false;
      case 'number':
        return '';
      default:
        return '';
    }
  }

  setAnswer(question: Question, value: unknown): void {
    this.answers.update((current) => ({ ...current, [question.code]: value as AnswerValue }));
    // Clear the server's complaint about this field as soon as it is touched.
    if (this.fieldErrors()[question.code]) {
      this.fieldErrors.update(({ [question.code]: _drop, ...rest }) => rest);
    }
  }

  /**
   * Which control to render.
   *
   * ponytail: driven primarily by whether the question HAS options, because
   * that is knowable at runtime, with `type` only used to refine. The `type`
   * vocabulary is not documented anywhere and could not be captured — every
   * `auth-*` route on UAT answers 503 as of 2026-09-22, so no token could be
   * obtained to read `questions/`. Tighten this to an exact `type` switch the
   * first time a live payload is available.
   */
  controlOf(question: Question): Control {
    const type = (question.type ?? '').toLowerCase();
    if (question.options?.length) {
      return type.includes('multi') || type.includes('checkbox') ? 'multi' : 'single';
    }
    if (type.includes('bool') || type.includes('toggle')) return 'boolean';
    if (type.includes('number') || type.includes('int') || type.includes('decimal'))
      return 'number';
    return 'text';
  }

  optionsOf(question: Question) {
    return (question.options ?? []).map((o) => ({ label: o.label, value: o.value }));
  }

  asStringArray(value: AnswerValue): string[] {
    return Array.isArray(value) ? value : [];
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  private identityPatch(): UserDetailsPatch {
    const u = this.user();
    if (!u) return {};
    const patch: UserDetailsPatch = {};
    if (this.firstName() !== (u.first_name ?? '')) patch.first_name = this.firstName();
    if (this.lastName() !== (u.last_name ?? '')) patch.last_name = this.lastName();
    if (this.city() !== (u.city ?? '')) patch.city = this.city();
    if (this.location() !== (u.location ?? '')) patch.location = this.location();
    return patch;
  }

  async save(): Promise<void> {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    this.fieldErrors.set({});

    const before = this.auth.profileStatus();

    try {
      // The user row and the answers are two different resources, so this is
      // two writes. The identity patch is skipped when nothing changed — an
      // empty body is a 400 ("Send at least one field to update.").
      await this.account.updateUser(this.identityPatch());

      // `null` is REFUSED by this endpoint rather than read as "clear", so an
      // untouched answer is omitted entirely. PATCH is partial by definition:
      // a code left out keeps whatever it had.
      const result = await this.onboarding.saveAnswers(this.nonNullAnswers());

      // The write always succeeds; the milestone advances only when every
      // required, shown question has an answer. A non-empty `missing` is NOT an
      // error — it is a partial save, which is a supported thing to do.
      if (result.missing.length) {
        this.notify.info(
          'Saved',
          `Still to answer: ${result.missing.length} question${result.missing.length === 1 ? '' : 's'}.`,
        );
        return;
      }

      // RULE 5, and the single most common integration bug on this surface:
      // `miles.onboarding_required` is minted INTO the access token, so if the
      // milestone just advanced we must rotate BEFORE navigating. Skipping this
      // re-reads a stale claim and bounces the user straight back into the
      // onboarding they just finished.
      if (result.profile_status !== before) {
        await this.auth.forceRefresh();
      }

      this.notify.success('Saved', 'Your profile has been updated.');
      if (this.isOnboarding()) await this.router.navigateByUrl('/');
    } catch (err) {
      this.applyFieldErrors(err);
    } finally {
      this.isSaving.set(false);
    }
  }

  private nonNullAnswers(): AnswerMap {
    return Object.fromEntries(
      Object.entries(this.answers()).filter(([, v]) => v !== null && v !== undefined),
    );
  }

  // ── Unsaved-changes protection ────────────────────────────────────────────

  /**
   * True once the user has changed anything that is not yet persisted.
   *
   * Onboarding is the case that matters: several answers typed and then a stray
   * back-navigation loses all of them, and the API has no draft state to
   * recover from — a partial `PATCH profile/` is the only thing that persists.
   */
  readonly isDirty = computed(() => {
    if (Object.keys(this.identityPatch()).length) return true;
    const saved = this.onboarding.answers.hasValue() ? (this.onboarding.answers.value() ?? {}) : {};
    const current = this.answers();
    return Object.keys(current).some(
      (code) => JSON.stringify(current[code]) !== JSON.stringify(saved[code]),
    );
  });

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.isDirty() || this.isSaving()) return;
    event.preventDefault();
  }

  /** Wired by `canDeactivateExamGuard` on the profile route. */
  canDeactivate(): Observable<boolean> | boolean {
    if (!this.isDirty() || this.isSaving()) return true;

    const dialogRef = this.dialog.open<
      UtilsDialog,
      { action?: DialogButton['action']; result: boolean }
    >(UtilsDialog, {
      data: {
        title: 'Leave without saving?',
        content: [
          {
            type: 'text',
            value: 'Your answers have not been saved yet and will be lost if you leave now.',
          },
        ],
        buttons: [
          { label: 'Keep editing', variant: 'outline', action: 'close' },
          { label: 'Leave', variant: 'destructive', action: 'confirm' },
        ],
      },
    });

    return dialogRef.afterClosed$.pipe(map((result) => result?.action === 'confirm'));
  }

  /** A 400 here is keyed by question code, one message per bad answer. */
  private applyFieldErrors(err: unknown): void {
    const body = (err as { error?: unknown })?.error;
    if (typeof body === 'object' && body !== null) {
      const fields = Object.fromEntries(
        Object.entries(body as Record<string, unknown>).filter(
          (e): e is [string, string] => typeof e[1] === 'string',
        ),
      );
      if (Object.keys(fields).length) {
        this.fieldErrors.set(fields);
        return;
      }
    }
    this.logger.error('Profile save failed', err);
    this.notify.error('Save failed', 'Could not save your profile. Please try again.');
  }
}

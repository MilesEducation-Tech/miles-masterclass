import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, applyEach, form, hidden, required, validate } from '@angular/forms/signals';
import { Observable, map } from 'rxjs';

import { NgpCheckbox } from 'ng-primitives/checkbox';
import { NgpDescription, NgpFormField, NgpLabel } from 'ng-primitives/form-field';
import { NgpInput } from 'ng-primitives/input';
import { NgpTextarea } from 'ng-primitives/textarea';
import { Select } from '@shared/ui/select/select';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import {
  AnswerMap,
  AnswerValue,
  Question,
  QuestionOption,
  UserDetails,
  UserDetailsPatch,
} from '@core/models/account.model';
import { AccountApi } from '@core/services/account-api/account-api';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { OnboardingApi } from '@core/services/onboarding-api/onboarding-api';
import { NotificationService } from '@core/services/notification/notification';
import { Logger } from '@core/services/logger/logger';
import { Dialog } from '@core/services/dialog/dialog';
import { DialogButton, UtilsDialog } from '@shared/dialogs/utils-dialog/utils-dialog';

/** Which control a question renders as. */
export type Control = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'single' | 'multi';

/**
 * One question, prepared for the template.
 *
 * `index` is the position in the form array — the template needs it to reach
 * `form[index]`, and the schema's `applyEach` logic gets the same number back
 * from its item context, which is what joins a field to its question.
 */
interface Entry {
  index: number;
  question: Question;
  control: Control;
  /** Options as the aria controls want them — `value` is the option KEY. */
  options: { label: string; value: string }[];
}

/**
 * One row of the form model.
 *
 * Three typed slots rather than one `AnswerValue` union, because a field binds
 * to a CONTROL: a multiselect needs `string[]`, a checkbox needs `boolean`, and
 * a union satisfies neither without a cast at every binding. Which slot a
 * question uses follows from its `answer_format` and nothing else.
 */
interface AnswerField {
  /** The question `code` — the key this answer is stored under. */
  code: string;
  /** Text, textarea, number and date, plus the chosen KEY of a single-select. */
  text: string;
  /** The chosen KEYS of a multi-select. */
  choices: string[];
  /** Boolean formats. */
  flag: boolean;
}

/**
 * The aria controls speak in single string values; `questions/` speaks in value
 * LISTS (`value: ["licensed_accountant"]`, even for a single-select). The key
 * bridges the two, and an option is always looked up by it rather than the key
 * being split apart — so a value containing the separator cannot corrupt the
 * answer that goes back to the API.
 */
export function optionKey(option: QuestionOption): string {
  return option.value.join('|');
}

export function keysToValues(question: Question, keys: readonly string[]): string[] {
  const byKey = new Map((question.options ?? []).map((o) => [optionKey(o), o.value]));
  return keys.flatMap((key) => byKey.get(key) ?? []);
}

export function valuesToKeys(question: Question, values: readonly string[]): string[] {
  const given = new Set(values);
  return (question.options ?? [])
    .filter((o) => o.value.length > 0 && o.value.every((v) => given.has(v)))
    .map(optionKey);
}

/** An answer is a list for the select formats and a scalar for the rest. */
function asList(value: AnswerValue | undefined): string[] {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [String(value)];
}

export function controlOf(question: Question): Control {
  switch (question.answer_format) {
    case 'single_select':
      return 'single';
    case 'multi_select':
      return 'multi';
    case 'textarea':
      return 'textarea';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'text':
      return 'text';
    default:
      // An unknown format is not an error: options mean a choice, anything else
      // is free text.
      return question.options?.length ? 'single' : 'text';
  }
}

/**
 * Codes the user row can answer on the learner's behalf.
 *
 * The questionnaire OWNS the form — `first_name` and `email` are questions like
 * any other and render from `questions/` alone. This only decides what a blank
 * one starts out showing, so a learner whose name the SSO already knows is not
 * asked to type it again.
 */
function rowDefaults(user: UserDetails | null): Record<string, string> {
  if (!user) return {};
  return {
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    middle_name: user.middle_name ?? '',
    email: user.email ?? '',
    phone_number: user.phone_number ?? '',
    city: user.city ?? '',
    location: user.location ?? '',
  };
}

/** Answer codes that are also columns on the user row, and writable there. */
const ROW_WRITABLE = ['first_name', 'last_name', 'city', 'location'] as const;

/**
 * Profile and onboarding.
 *
 * EVERY field on this page comes from `GET questions/` — there is no fixed
 * form here and adding a question is a backend change, not a frontend one. The
 * backend decides which questions exist, in what order, with what options,
 * which are required and which are revealed by an earlier answer.
 *
 *   - `questions/` says what to render.
 *   - `profile/` says what has been answered. The two join on `code`.
 *   - `user_details/` is not a second form; it only seeds blanks (see
 *     `rowDefaults`) and takes back the four codes that are also columns on it.
 *
 * Built on signal forms: the model is one row per question, the schema is
 * applied per item by `applyEach`, and `required` / `hidden` are driven by the
 * payload's own `is_required` and `parent_question` fields.
 */
@Component({
  selector: 'app-profile',
  imports: [
    FormField,
    NgpCheckbox,
    NgpDescription,
    NgpFormField,
    NgpInput,
    NgpLabel,
    NgpTextarea,
    Select,
    Button,
    Spinner,
  ],
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

  private readonly user = computed(() =>
    this.account.user.hasValue() ? this.account.user.value() : null,
  );

  // ── The questionnaire ─────────────────────────────────────────────────────

  /** Already sorted by `display_order` server-side; no client ordering. */
  private readonly questions = computed<Question[]>(() =>
    this.onboarding.questions.hasValue()
      ? (this.onboarding.questions.value()?.Questions ?? [])
      : [],
  );

  /** Control + option keys, derived from `questions/` alone so they stay stable
   *  while the learner types. */
  private readonly entries = computed<Entry[]>(() =>
    this.questions().map((question, index) => ({
      index,
      question,
      control: controlOf(question),
      options: (question.options ?? []).map((o) => ({ label: o.text, value: optionKey(o) })),
    })),
  );

  private readonly byCode = computed(
    () => new Map(this.entries().map((entry) => [entry.question.code, entry])),
  );

  /** What `profile/` already holds. */
  private readonly saved = computed<AnswerMap>(() =>
    this.onboarding.answers.hasValue() ? (this.onboarding.answers.value() ?? {}) : {},
  );

  /**
   * The form model: one row per question, re-seeded whenever either resource
   * reloads but written straight through by the form in between — which is
   * exactly `linkedSignal`, and it means a reload after save does not strand
   * what the learner typed.
   */
  private readonly model = linkedSignal<AnswerField[]>(() => {
    const answers = this.saved();
    const defaults = rowDefaults(this.user());
    return this.entries().map(({ question, control }) => {
      const code = question.code;
      const stored = answers[code];
      const blank: AnswerField = { code, text: '', choices: [], flag: false };

      switch (control) {
        case 'multi':
          return { ...blank, choices: valuesToKeys(question, asList(stored)) };
        case 'single':
          // One key, in the same slot as a multi-select — the only difference
          // is that the primitive is not in `multiple` mode.
          return { ...blank, choices: valuesToKeys(question, asList(stored)).slice(0, 1) };
        case 'boolean':
          return { ...blank, flag: stored === true };
        default:
          return {
            ...blank,
            text: stored === undefined || stored === null ? (defaults[code] ?? '') : String(stored),
          };
      }
    });
  });

  /**
   * The form.
   *
   * `applyEach` is what makes a server-driven form possible: one schema, applied
   * to every row, with the question behind each row reached through the item
   * context's `index`.
   */
  protected readonly form = form<AnswerField[]>(this.model, (path) => {
    applyEach(path, (item) => {
      // Every rule joins back to its question through the row's own `code`.
      // `index` is only on the ITEM context, not on its children, and the code
      // is the better key anyway — it survives the list being re-ordered.
      //
      // A gated question is HIDDEN, not merely unrendered. A hidden field does
      // not contribute to its parent's validity, so a required question the
      // learner can't even see cannot block the form — the bug this would
      // otherwise be.
      hidden(item, { when: ({ value }) => !this.isRevealed(value().code) });

      required(item.text, {
        when: ({ valueOf }) => this.requiresSlot(valueOf(item.code), 'text'),
        message: 'This answer is required.',
      });

      // `choices` needs BOTH rules, and neither is redundant:
      //
      //  - `required` carries the REQUIRED metadata, which is what marks the
      //    control `aria-required` through `[formField]`. It raises no error
      //    here, because the forms package's emptiness test is
      //    `'' | false | null | undefined | NaN` — an empty ARRAY is not empty
      //    to it.
      //  - `validate` is therefore the rule that actually fires, for BOTH
      //    select kinds, since a single-select holds its one key in this slot.
      required(item.choices, {
        when: ({ valueOf }) => this.requiresSlot(valueOf(item.code), 'choices'),
      });
      validate(item.choices, ({ valueOf, value }) =>
        this.requiresSlot(valueOf(item.code), 'choices') && value().length === 0
          ? { kind: 'required', message: 'Choose an option.' }
          : null,
      );

      // No rule on `flag`: `false` IS an answer to a yes/no question, and
      // requiring `true` would turn every optional consent into a blocker.
    });
  });

  /** Groups for the template. `section` is a label — it does NOT affect order,
   *  so groups are built in first-appearance order and keep the server's. */
  readonly sections = computed(() => {
    const groups = new Map<string, Entry[]>();
    for (const entry of this.entries()) {
      const key = entry.question.section || '';
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(entry);
    }
    return Array.from(groups, ([title, entries]) => ({ title, entries }));
  });

  /** The current answer VALUES (not keys) per code — what gating reads. */
  private readonly currentValues = computed<Map<string, string[]>>(() => {
    const rows = this.model();
    const out = new Map<string, string[]>();
    for (const { index, question, control } of this.entries()) {
      const row = rows[index];
      if (!row) continue;
      switch (control) {
        case 'multi':
        case 'single':
          out.set(question.code, keysToValues(question, row.choices));
          break;
        case 'boolean':
          out.set(question.code, [String(row.flag)]);
          break;
        default:
          out.set(question.code, row.text ? [row.text] : []);
      }
    }
    return out;
  });

  /**
   * A gated question shows only once its parent holds the answer that reveals
   * it. A parent we cannot resolve shows the child rather than hiding it — a
   * mis-read gate must never make a question unanswerable.
   */
  private isRevealed(code: string): boolean {
    const question = this.byCode().get(code)?.question;
    if (!question?.parent_question) return true;

    const parent = this.questions().find((q) => q.id === question.parent_question);
    if (!parent) return true;

    const given = this.currentValues().get(parent.code) ?? [];
    const expected = question.parent_answer_value;
    if (expected === null) return given.length > 0;
    return (Array.isArray(expected) ? expected : [expected]).some((v) => given.includes(v));
  }

  /** Whether the question behind `code` must fill a given slot. */
  private requiresSlot(code: string, slot: 'text' | 'choices'): boolean {
    const entry = this.byCode().get(code);
    if (!entry?.question.is_required) return false;
    const isChoice = entry.control === 'single' || entry.control === 'multi';
    return slot === 'choices' ? isChoice : !isChoice && entry.control !== 'boolean';
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  /**
   * The model back in the API's shape: selects give the option's value LIST
   * verbatim, booleans give a boolean, numbers give a number.
   *
   * A hidden question is never sent — its answer is not one the learner was
   * asked for. An untouched blank is omitted too, since PATCH is partial and an
   * omitted code keeps whatever it had; a blank that CLEARS a stored answer is
   * sent, because omitting it would silently ignore the edit.
   */
  private toAnswerMap(): AnswerMap {
    const rows = this.model();
    const stored = this.saved();
    const out: AnswerMap = {};

    for (const { index, question, control } of this.entries()) {
      const row = rows[index];
      if (!row || !this.isRevealed(question.code)) continue;
      const code = question.code;

      switch (control) {
        case 'multi':
        case 'single': {
          const values = keysToValues(question, row.choices);
          if (values.length || code in stored) out[code] = values;
          break;
        }
        case 'boolean':
          out[code] = row.flag;
          break;
        case 'number': {
          const text = row.text.trim();
          if (text !== '') out[code] = Number(text);
          break;
        }
        default: {
          const text = row.text.trim();
          if (text !== '' || code in stored) out[code] = text;
        }
      }
    }
    return out;
  }

  /**
   * The four answers that are also columns on the user row, mirrored back so
   * the name the app renders everywhere else follows the form. Idempotent: an
   * unchanged value is not sent, and an empty patch is refused before it can
   * become a 400.
   */
  private identityPatch(answers: AnswerMap): UserDetailsPatch {
    const user = this.user();
    if (!user) return {};
    const patch: UserDetailsPatch = {};
    for (const key of ROW_WRITABLE) {
      const next = answers[key];
      if (typeof next === 'string' && next !== (user[key] ?? '')) patch[key] = next;
    }
    return patch;
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    void this.save();
  }

  async save(): Promise<void> {
    if (this.isSaving()) return;

    // Errors only show on a touched field, so an untouched required question
    // would otherwise reject the submit with nothing on screen to explain it.
    this.form().markAsTouched();
    if (this.form().invalid()) return;

    this.isSaving.set(true);
    this.fieldErrors.set({});

    try {
      const answers = this.toAnswerMap();

      // The user row and the answers are two different resources, so this is
      // two writes.
      await this.account.updateUser(this.identityPatch(answers));

      // `null` is REFUSED by this endpoint rather than read as "clear", so no
      // code is ever sent as null. PATCH is partial by definition: a code left
      // out keeps whatever it had.
      const result = await this.onboarding.saveAnswers(answers);

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

      this.notify.success('Saved', 'Your profile has been updated.');
      if (this.isOnboarding()) await this.router.navigateByUrl('/');
    } catch (err) {
      this.applyFieldErrors(err);
    } finally {
      this.isSaving.set(false);
    }
  }

  // ── Unsaved-changes protection ────────────────────────────────────────────

  /**
   * Onboarding is the case that matters: several answers typed and then a stray
   * back-navigation loses all of them, and the API has no draft state to
   * recover from — a partial `PATCH profile/` is the only thing that persists.
   */
  readonly isDirty = computed(() => this.form().dirty());

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

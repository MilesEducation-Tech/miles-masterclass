import { Component, computed, inject, linkedSignal } from '@angular/core';
import { FormField, applyEach, form, hidden, required, validate } from '@angular/forms/signals';
import { Observable } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { NgpCheckbox } from 'ng-primitives/checkbox';
import { NgpDescription, NgpFormField, NgpLabel } from 'ng-primitives/form-field';
import { NgpInput } from 'ng-primitives/input';
import { NgpTextarea } from 'ng-primitives/textarea';
import { Select } from '@shared/ui/select/select';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { AnswerMap, AnswerValue, Question, UserDetails } from '@core/models/account.model';
import { ProfileFacade } from '@features/auth/services/profile-facade';

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
  /** Options as the select wants them — `value` is the option's stored value. */
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
  /** Text, textarea, number and date. */
  text: string;
  /**
   * The chosen option values of a select. `app-select` writes a LIST in
   * `multiple` mode but ONE value otherwise, so read it through `asList()`.
   */
  choices: string[] | string;
  /** Boolean formats. */
  flag: boolean;
}

/** A select's slot as the list the API wants: `app-select` writes one value
 *  unless it is in `multiple` mode. */
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
 * Codes the user record can answer on the learner's behalf — the ONLY pre-fill
 * this form has, because `GET profile/` is not read (product decision
 * 2026-10-10). `user-details/` carries the name and nothing else, so every other
 * question starts blank, including ones the learner answered before.
 *
 * The questionnaire OWNS the form — `full_name` is a question like any other
 * and renders from `questions/` alone. This only decides what a blank one
 * starts out showing.
 */
export function rowDefaults(user: UserDetails | null): Record<string, string> {
  return user?.full_name ? { full_name: user.full_name } : {};
}

/**
 * Profile and onboarding.
 *
 * EVERY field on this page comes from `GET questions/` — there is no fixed
 * form here and adding a question is a backend change, not a frontend one. The
 * backend decides which questions exist, in what order, with what options,
 * which are required and which are revealed by an earlier answer.
 *
 *   - `questions/` says what to render.
 *   - `user-details/` pre-fills the name (see `rowDefaults`) and nothing else;
 *     `GET profile/` is not read. Every write is `PATCH profile/`.
 *
 * Built on signal forms: the model is one row per question, the schema is
 * applied per item by `applyEach`, and `required` / `hidden` are driven by the
 * payload's own `is_required` and `parent_question` fields.
 *
 * The page owns the form; `ProfileFacade` owns the data, the save and what follows it.
 */
@Component({
  selector: 'app-profile',
  // why: here and not on the route. The router keeps a route's injector after you leave, and the facade's state
  // (which questionnaire, saving, field errors) must start fresh on every visit.
  providers: [ProfileFacade],
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
    TranslocoPipe,
  ],
  templateUrl: './profile.html',
  host: {
    // Covers a tab close / reload, which the router guard below cannot see.
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class Profile {
  protected readonly facade = inject(ProfileFacade);
  // Synchronous: the auth route's resolver merged the `auth.*` dictionary before this page rendered.
  private readonly transloco = inject(TranslocoService);
  private readonly t = (key: string, params?: Record<string, unknown>): string =>
    this.transloco.translate(key, params);

  // ── The questionnaire ─────────────────────────────────────────────────────

  private readonly questions = this.facade.questions;

  /** Control + options, derived from `questions/` alone so they stay stable
   *  while the learner types. */
  private readonly entries = computed<Entry[]>(() =>
    this.questions().map((question, index) => ({
      index,
      question,
      control: controlOf(question),
      options: (question.options ?? []).map((o) => ({ label: o.text, value: o.value })),
    })),
  );

  private readonly byCode = computed(
    () => new Map(this.entries().map((entry) => [entry.question.code, entry])),
  );

  /**
   * The form model: one row per question, written straight through by the form
   * — which is `linkedSignal`.
   *
   * It re-seeds when `questions/` or `user-details/` reloads, and `user-details/`
   * reloads after EVERY save. With nothing else to seed from, a plain re-seed
   * would blank what the learner just saved; so an existing row is KEPT, and the
   * user record only fills a name that is still blank.
   */
  private readonly model = linkedSignal({
    source: () => ({ entries: this.entries(), defaults: rowDefaults(this.facade.user()) }),
    computation: ({ entries, defaults }, previous?: { value: AnswerField[] }): AnswerField[] => {
      const kept = new Map(previous?.value.map((row) => [row.code, row]));
      return entries.map(({ question, control }) => {
        const code = question.code;
        // A single-select holds one value (`''` = none chosen), a multi-select a list.
        const row = kept.get(code) ?? {
          code,
          text: '',
          choices: control === 'single' ? '' : [],
          flag: false,
        };
        return row.text || !defaults[code] ? row : { ...row, text: defaults[code] };
      });
    },
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
        message: this.t('auth.profile.errors.required'),
      });

      // `choices` needs BOTH rules, and neither is redundant:
      //
      //  - `required` carries the REQUIRED metadata, which is what marks the
      //    control `aria-required` through `[formField]`. It raises no error
      //    here, because the forms package's emptiness test is
      //    `'' | false | null | undefined | NaN` — an empty ARRAY is not empty
      //    to it.
      //  - `validate` is therefore the rule that actually fires, for BOTH
      //    select kinds, since a single-select holds its one value in this slot.
      required(item.choices, {
        when: ({ valueOf }) => this.requiresSlot(valueOf(item.code), 'choices'),
      });
      validate(item.choices, ({ valueOf, value }) =>
        this.requiresSlot(valueOf(item.code), 'choices') && value().length === 0
          ? { kind: 'required', message: this.t('auth.profile.errors.chooseOption') }
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

  /** The current answer values per code — what gating reads. */
  private readonly currentValues = computed<Map<string, string[]>>(() => {
    const rows = this.model();
    const out = new Map<string, string[]>();
    for (const { index, question, control } of this.entries()) {
      const row = rows[index];
      if (!row) continue;
      switch (control) {
        case 'multi':
        case 'single':
          out.set(question.code, asList(row.choices));
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
   * The model back in the API's shape: selects give a LIST of option values
   * (even a single-select), booleans give a boolean, numbers give a number.
   *
   * A hidden question is never sent — its answer is not one the learner was
   * asked for. A blank is NEVER sent: the form does not read what is already
   * saved (no `GET profile/`), so a blank here may sit over a stored answer the
   * learner cannot see, and PATCH is partial — an omitted code keeps its value.
   * The same goes for a checkbox: it shows unticked even when `true` is stored,
   * so only a tick is sent — a saved "yes" can be set but not taken back here.
   */
  private toAnswerMap(): AnswerMap {
    const rows = this.model();
    const out: AnswerMap = {};

    for (const { index, question, control } of this.entries()) {
      const row = rows[index];
      if (!row || !this.isRevealed(question.code)) continue;
      const code = question.code;

      switch (control) {
        case 'multi':
        case 'single': {
          // A select answer is a LIST on the wire, even for a single-select.
          const values = asList(row.choices);
          if (values.length) out[code] = values;
          break;
        }
        case 'boolean':
          if (row.flag) out[code] = true;
          break;
        case 'number': {
          const text = row.text.trim();
          if (text !== '') out[code] = Number(text);
          break;
        }
        default: {
          const text = row.text.trim();
          if (text !== '') out[code] = text;
        }
      }
    }
    return out;
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.save();
  }

  save(): void {
    if (this.facade.isSaving()) return;

    // Errors only show on a touched field, so an untouched required question
    // would otherwise reject the submit with nothing on screen to explain it.
    this.form().markAsTouched();
    if (this.form().invalid()) return;

    void this.facade.save(this.toAnswerMap());
  }

  // ── Unsaved-changes protection ────────────────────────────────────────────

  /** What the leave protection asks about; the dialog itself is `ProfileFacade.confirmLeave`. */
  readonly isDirty = computed(() => this.form().dirty());

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.isDirty() || this.facade.isSaving()) return;
    event.preventDefault();
  }

  /** Wired by `canDeactivateExamGuard` on the profile route. */
  canDeactivate(): Observable<boolean> | boolean {
    if (!this.isDirty() || this.facade.isSaving()) return true;
    return this.facade.confirmLeave();
  }
}

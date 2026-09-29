# Regenerate `shared/ui` as an ng-primitives kit

Approved 2026-09-29. Branch `refactor/MIL-<n>-ngp-ui-regenerate` is the integration branch; the six PRs
below stack into it and it merges to `master` only once the per-feature migration PRs turn `build:prod`
green again.

## Goal

Rebuild `src/app/shared/ui` as the full set of reusable components ng-primitives' own CLI generator
produces, bound to Angular Signal Forms only, styled with this project's Tailwind tokens, using
ng-primitives' default form-field layout (label above the control, no floating label).

## What was read

- `node_modules/ng-primitives/schematics/ng-generate/{schema.json,index.js,templates/**}` (0.131.0, the
  latest release): 32 generatable primitives, single-file components, `--styles unstyled` strips the
  example CSS, the 14 form controls implement `ControlValueAccessor`.
- `@angular/forms/fesm2022/signals.mjs` and `@angular/core/fesm2022/_debug_node-chunk.mjs` (22.2):
  `[formField]` detects a custom control by a `value`/`valueChange` or `checked`/`checkedChange` pair,
  including host-directive aliases; writes `disabled`, `required`, `readonly`, `invalid`, `errors`,
  `touched`, … into any directive on the host with that input; honours a `touch` output; provides an
  interop `NgControl` that ng-primitives' `NgpFormField` / `ngpFormControl` read.
- Every caller of the old kit (~430 call sites, 142 files), `src/styles/styles.css` tokens,
  `eslint.config.mjs`, `scripts/check-structure.mjs`, `.storybook/*`, `src/test-setup.ts`.

## Locked decisions

1. Generation only through `pnpm ng g ng-primitives:primitive <name> --path src/app/shared/ui/<folder>
--prefix app --component-suffix "" --file-suffix "" --styles unstyled --change-detection OnPush`
   (the user relaxed the `ng generate` guard in `.claude/hooks/guard-bash.mjs`).
2. New public API only; existing callers migrate in later per-feature PRs. `spinner`, `error-state`,
   `page-loading` (not primitives) are restored as-is; `app-forms`, `dialog-shell`, `select-menu`,
   `tab-strip`, `checkbox-list`, `otp`, `aria/*` are replaced by the kit.
3. `@angular-eslint/component-selector` allows `['element', 'attribute']`, so `button[app-button]`,
   `input[app-input]`, `textarea[app-textarea]`, `select[app-select]` stay native elements.
4. Scope = the 32 CLI primitives: accordion, avatar, button, checkbox, combobox, date-picker, dialog,
   file-upload, form-field (`app-field`), input, input-otp, listbox, menu, meter, native-select,
   pagination, popover, progress, radio, rating, search, select, separator, slider, switch, tabs,
   textarea, toast, toggle, toggle-group, toolbar, tooltip.
5. Signal forms only, enforced: a `no-restricted-imports` block scoped to `src/app/shared/ui/**` bans
   `@angular/forms` (root) and `provideValueAccessor` / `ChangeFn` / `TouchedFn` from `ng-primitives/utils`.

## The control contract

- Host-directive controls (checkbox, switch, toggle, radio-group, toggle-group, rating, slider, select,
  date-picker): delete the generated CVA; keep or re-alias the pair to `value`/`valueChange`
  (`checked`/`checkedChange` for checkbox, switch, toggle); keep the `disabled` alias; add
  `readonly touch = output<void>()` emitted on `focusout`.
- Template-hosted controls (combobox, listbox, search, input-otp): own `value = model<T>(…)` plus `touch`.
- Controls whose primitive does not call `ngpFormControl` (date-picker, listbox, toggle, toggle-group,
  input-otp) add `NgpFormControl` to `hostDirectives`.
- Native wrappers (input, textarea, native-select) need nothing; `[formField]` binds the element.
- Form models never hold `undefined` (`''`, `null`, `false`, `[]`, `0`), because ng-primitives'
  controlled state latches only once the aliased input is defined.

## Styling

`--styles unstyled`, then utilities in the inline template and `host: { '[class]' }` via `cn()`:
`bg-background|popover|dialog`, `text-foreground|muted-foreground`, `bg-primary text-primary-foreground`,
`border-border|input`, `data-focus-visible:outline-ring`, `data-hover:bg-muted`, `data-press:bg-secondary`,
`data-checked:bg-primary`, `data-disabled:opacity-50`, `data-invalid:data-touched:border-destructive`,
`data-enter:animate-in data-exit:animate-out` (tailwindcss-animate). A component `.css` only for
keyframes / `:host[data-*]` maths (toast), with a `structure-baseline.json` entry.

## PRs

| PR  | contents                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | tooling (ESLint, baseline, `.storybook/tsconfig.ui.json` + `STORIES` env), helpers restored, **button, dialog, toast**, `kit.spec.ts`, `test-setup.ts` binds the feature-dialog tokens to a stub |
| 2   | field, input, textarea, native-select, separator + `testing/signal-form-host.ts`                                                                                                                 |
| 3   | checkbox, switch, toggle, radio, toggle-group, rating, slider                                                                                                                                    |
| 4   | select, combobox, listbox, search, input-otp                                                                                                                                                     |
| 5   | popover, tooltip, menu, pagination, date-picker                                                                                                                                                  |
| 6   | accordion, tabs, toolbar, avatar, meter, progress, file-upload                                                                                                                                   |

Every form-bound component gets a contract spec (`form()` + `[formField]`: model→view, view→model,
`disabled()`, `focusout`→`touched()`, `required()`+touched→`aria-invalid`); every component gets a story.

## Verification per PR

```bash
pnpm ng test --watch=false --include 'src/app/shared/ui/**/*.spec.ts'
pnpm lint && pnpm format
STORIES='../src/app/shared/ui/**/*.stories.ts' pnpm ng run miles-masterclass-v3:storybook --ts-config .storybook/tsconfig.ui.json
pnpm build:prod   # red until the migration PRs: unresolved @shared/ui imports in features/admin/layout
```

## Follow-ups

Per-feature migration PRs (plus `testing/mocks/dialog-ref.mock.ts`), removal of the Storybook narrowing,
the `{ label, value }` options decision for select/combobox/listbox, harness retirement.

## Migration (done 2026-09-29, same session)

All old call sites were rewritten by a one-off codemod (scratchpad only, not committed) plus hand fixes,
after the kit review found the overlays unpositioned (the generator's `position: absolute` / `fixed`
had not been carried into the utilities) and the accordion hover overflowing its frame.

Mapping: `<app-button variant size (clicked)>` → `<button app-button type="button" variant size (click)>`
(`default` kept as the white default variant, `primary` stays blue, `close` → `variant="ghost" size="icon"` + `heroXMark`, `size="link"` →
`class="h-auto p-0"`); `<app-dialog-shell maxWidth width position>` → `<app-dialog panelClass="p-0 max-w-[…]" position>`;
`<app-forms (submitted)>` → `<form (submit)="$event.preventDefault(); …">`; `<app-aria-input>` →
`<app-field [errors]="f.x().errors()"><label ngpLabel for><input app-input id [formField]/></app-field>`
(checkbox → `app-checkbox` in a `flex-row` field, textarea → `textarea[app-textarea]`, `[(value)]` →
`[value]` + `(input)`); `<app-aria-select|multiselect>` → `app-select` (`[multiple]`); `<app-aria-autocomplete>` →
`app-combobox` (`queryChange`, `serverFiltered`); `<app-tab-strip>` → `app-tabs` + `app-tab`;
`<app-checkbox-list>` → `app-listbox` + `app-listbox-option`; `<app-otp>` → `app-input-otp`;
`<app-progress indeterminate>` → `[value]="null"`. Kit additions for the callers: object options,
`app-dialog` `closable` / `width` / `maxWidth`, `app-field [errors]`, OTP `autoFocus`, button `icon`
size, class merging on button and field.

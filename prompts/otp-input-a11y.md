# OTP input: accessible, styled states, full signal-forms contract

Approved 2026-09-27. Skills read: `angular-primitives` (reference `primitives/input-otp`), plus the primitive source
in `node_modules/ng-primitives/fesm2022/ng-primitives-input-otp.mjs` (v0.131).

## Jira ticket

**Summary:** `feat(shared): make the OTP input accessible and auto-submit on completion`

**Issue type:** Story
**Component / scope:** shared
**Branch:** `feat/MIL-XXX-otp-input-a11y`
**Links:** relates to MIL-10 (auth minor fixes) · `prompts/otp-input-a11y.md` · ng-primitives input-otp docs

### Context

`<app-otp>` (used on login, faculty and webinar registration) is built on the ng-primitives OTP directives,
but the wrapper doesn't use the state the primitive exposes. The real input is visually hidden, so nothing
on screen shows keyboard focus, and assistive tech gets no error or required state.

### Current behaviour

- No visible focus or caret on the active digit box, which fails WCAG 2.4.7.
- The hidden input has no `aria-invalid`, `aria-required` or `aria-describedby`, and an `aria-label` overrides the visible label.
- `errors` and `disabledReasons` are typed `any[]`, and an empty `role="alert"` renders once the field is touched.
- Six fixed 48 px boxes wrap onto two rows on a 320 px screen.
- The user has to press Verify after typing or pasting the full code.

### Expected behaviour

- The active box shows a ring and a blinking caret (static with reduced motion). Error and disabled states are styled.
- Screen readers announce the label, required, invalid and the error or hint text.
- `[formField]` binds `required`, `name`, `errors` and `touched` with signal-forms types.
- The boxes shrink in one row on narrow screens.
- A complete code (typed or pasted, e.g. `123 456`) submits the form once.

### Scope

- In: `shared/ui/otp` (component, spec, story), caret keyframes + theme token, `(completed)` on the 3 call sites.
- Out: the login `placeholder=""` change (MIL-10), and any change to the OTP length (backend open item).

### Acceptance criteria

- [ ] Keyboard focus is visible on the active box, and the caret blinks (and stays static with reduced motion).
- [ ] The input's accessible name is the visible label, with `aria-required`, `aria-invalid` and `aria-describedby` set correctly.
- [ ] No `any` in `otp.ts`, and it's removed from `LEGACY_ANY_FILES`.
- [ ] Pasting `123 456` fills all six boxes and calls verify exactly once.
- [ ] The boxes are 48 px at 375 px and up, and one row with no horizontal scroll at 320 px.
- [ ] `pnpm lint`, `pnpm ng test --watch=false`, `pnpm build:prod` and `pnpm check:structure` are green (macOS, Node 24.15).

### How to verify

`pnpm start` → `/auth/login` → request a code → on the OTP step: Tab in (ring + caret), blur while empty
(red border + "Please enter the OTP"), paste `123 456` (auto-verify, network `auth-otp-verify/`).
Repeat on the faculty page and in webinar registration. Storybook: `UI/OTP` → `Invalid`.

### Risks / assumptions / open questions

- An auto-submitted wrong paste on login uses one of the 5 attempts. This was accepted.
- Webinar registration's `verifyOtp()` is still a no-op, so auto-submit there is wired but does nothing yet.

**Estimate:** M (~330 lines including the spec)

## Goal

Make `shared/ui/otp` (`<app-otp>`) accessible, give it visible states, fully implement the signal-forms contract,
and auto-submit the three OTP forms once the code is complete.

## What it read

- `shared/ui/otp/otp.ts|html|stories.ts` is already on `ngpInputOtp`: one visually hidden input and presentational slots.
- The primitive exposes `data-active`, `data-filled`, `data-caret` and `data-placeholder` on each slot, and
  `data-focus` and `data-disabled` on the root (`ngpInteractions`). On paste it trims the text, filters it by
  pattern and clamps it to the length.
- `FormUiControl` in `@angular/forms/signals` 22.2: `errors`, `disabledReasons`, `name`, `required`…
- `shared/ui/aria/aria-input` is the in-repo pattern for `describedBy` / `aria-invalid` / the `role="alert"` errors.
- Call sites: `features/auth/pages/login`, `features/faculty/pages/faculty` and `shared/components/webinar-registration-form`.

## Problems

1. No visible focus or caret. The real input is visually hidden and no slot is styled for its state (WCAG 2.4.7).
2. No `aria-invalid`, `aria-required`, `aria-describedby` or `name` on the input. `aria-label` overrides the visible label.
3. `errors` and `disabledReasons` are typed `any[]`, and an empty `role="alert"` renders when the field is touched.
4. Six fixed 48 px slots overflow a 320 px screen and wrap.
5. No completion event (the decision was to auto-submit on all 3 call sites).

## Locked decisions

- Auto-submit on completion on all 3 call sites.
- No `pasteTransformer`, because the primitive already strips separators.
- Readonly stays mapped to disabled, because the primitive's paste handler bypasses native `readonly`.
- The caret keyframes are global (`animation.css`) plus an `@theme` token, so no component CSS is needed.

## Files touched

- `src/app/shared/ui/otp/otp.ts`, `otp.html`, `otp.stories.ts`, `otp.spec.ts` (new)
- `src/styles/styles.css` (`--animate-caret-blink`), `src/styles/animation.css` (`@keyframes caret-blink`)
- `features/auth/pages/login/login.html`, `features/faculty/pages/faculty/faculty.html`,
  `shared/components/webinar-registration-form/webinar-registration-form.html`: `(completed)`

## Acceptance criteria

- A keyboard user sees a ring on the active slot and a blinking caret. The caret doesn't blink with reduced motion.
- A screen reader announces the label, the required state, the invalid state and the error text.
- `[formField]` binds `required`, `name`, `errors` and `touched` with no `any`.
- Pasting `123 456` fills the code and submits the form once.
- The slots shrink at 320 px without wrapping. Nothing visibly changes at 375 px and up, apart from the new focus and caret states.

## Checks

`pnpm lint`, `pnpm ng test --watch=false`, `pnpm build:prod`, `pnpm check:structure`, then check `/auth/login` in a browser.

## Risks

- Auto-submitting a wrong paste on login costs one of the 5 attempts. That's accepted, and the existing counter warns.

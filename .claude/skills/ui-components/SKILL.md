---
name: ui-components
description: The shared UI layer of Miles Masterclass v3 — ui/ primitives, cards, dialogs, carousel, layout shell, Tailwind v4 conventions, @angular/aria accessibility and Storybook. Read before building any visual component, adding a dialog, or styling a page.
---

# UI components

`src/app/shared/components/`. Check here before building anything visual — most of it exists.

## Primitives — `ui/`

`button`, `form-field`, `forms`, `checkbox-list`, `select-menu`, `autocomplete`, `otp`, `tab-strip`, `progress`, `spinner`, `page-loading`, `toast`, `error-state`, `language-selector`, `aria/`.

`ui/aria/` wraps `@angular/aria` primitives (listbox, etc.). Use these rather than hand-rolling ARIA.

## Composites

| Folder                                                                                                                                                                                                                                                                                                                   |                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cards/`                                                                                                                                                                                                                                                                                                                 | `vertical`, `horizontal`, `square`, `hover`, `coming-soon`, `instructor-card`, `badge-card`, `badge-course-card`, `badge-hero-card`, `badge-level-card`, `caira-credly-badge` |
| `dialog/`                                                                                                                                                                                                                                                                                                                | 25 dialogs — see below                                                                                                                                                        |
| `carousel/`                                                                                                                                                                                                                                                                                                              | Swiper 12 wrapper. Use it; don't import Swiper directly.                                                                                                                      |
| `video-js/`, `audio-js/`, `video-poster/`                                                                                                                                                                                                                                                                                | See the `media-players` skill                                                                                                                                                 |
| `skeleton/`, `notification/`, `heading/`, `slider/`, `marquee/`, `record-disk/`, `wave-canvas/`, `rating-star/`, `section-nav/`, `categories-list/`, `nav-menu-item/`, `user-avatar-menu/`, `backward/`, `miles-slug/`, `consent-banner/`, `enquiry-form/`, `course-about/`, `course-related-section/`, `plan-benefits/` |                                                                                                                                                                               |

## Layout shell

`src/app/layout/` — `header`, `footer`, `footer-overlay`. Wrapped by `pages/dynamic-layout` (standard chrome), `main-layout`, `plain-layout` (Flutter WebView — no header/footer), `blog-layout`.

A route opts into the plain shell with `data: { layout: 'plain' }`.

## Dialogs

**Every dialog lives in `shared/components/dialog/`** — never in a feature folder, even a single-use one. Existing: app-download, assessment-result, badge-claim-upsell, badge-info, block-status, calendly, cart-drawer, certificate-download, coupon, course-info, cpe-compliance, filter, firm-sponsorship, global-search, html-content, partner-code-prompt, profile-completion, select-cpe-mode, share, subscription, utils-dialog, version-update, video, webinar-details, webinar-registration.

`utils-dialog` is the generic confirm/alert — reach for it before writing a new one.

Opened imperatively through the `Dialog` service (`core-services` skill). Pass `environmentInjector` when the dialog injects a route-scoped facade, or it resolves against root and gets a different instance.

## Tailwind v4

- Styling is Tailwind classes in the template. Component CSS only for what Tailwind genuinely can't express (`::ng-deep` into Video.js, keyframes).
- Compose conditional classes with `clsx` + `tailwind-merge` — never string concatenation, which loses the merge and leaves conflicting utilities.
- **No raw hex.** Use theme tokens. A one-off colour means the token is missing — add it.
- Mobile-first. Design for 375 / 768 / 1280.
- `tailwindcss-animate` is available; use it before hand-writing keyframes.
- Component style budget is **12 kB warn / 16 kB error**. A component approaching it is doing too much.

## Accessibility

Non-negotiable, and never simplified away:

- Every interactive element is reachable and operable by keyboard, with a visible focus ring.
- Icon-only buttons get an `aria-label`. `@ng-icons` output is decorative — mark it `aria-hidden`.
- Dialogs trap focus, close on `Escape`, and restore focus to the trigger.
- Images carry meaningful `alt`; decorative images carry `alt=""`.
- Text contrast ≥ 4.5:1; large text ≥ 3:1.
- Form errors are announced, not just coloured red.

`@angular/aria` v22 gotchas: listbox **follow mode auto-selects the first option** — use explicit mode when that's wrong. Pruning options emits an empty `valueChange`; treat it as bookkeeping, not a user selection.

## Storybook

`pnpm storybook` → port 6006. Stories are `*.stories.ts` co-located with the component (see `cpe-tracker/shared/components/*`). Add one for any new reusable primitive, with the loading / empty / error / disabled states. `@storybook/addon-a11y` is installed — check the a11y panel. Guide: `docs/STORYBOOK.md`.

## Building a new component — the ladder

1. Does it need to exist? Composing two existing components usually wins.
2. Is it already in `shared/components/`? Grep before writing.
3. Does a native element cover it? (`<dialog>`, `<details>`, `<input type="date">`)
4. Does `@angular/aria` or `@angular/cdk` cover it?
5. Only then write it — in `shared/components/` if two features will use it, otherwise in the feature's own folder.

## States

Every data-driven component renders four states. Missing ones are the most common review finding here:

- **Loading** — `skeleton/` or `ui/spinner`, never a blank screen.
- **Empty** — `@empty` on `@for`, with copy that says what to do next.
- **Error** — `ui/error-state`, with a retry.
- **Disabled / permission-denied** — visible and explained, not silently absent.

## Checklist

- Reused an existing component rather than building a near-duplicate.
- Tailwind tokens, no raw hex, `tailwind-merge` for conditionals.
- Responsive at 375 / 768 / 1280.
- Keyboard path + focus ring + labels verified.
- All four states rendered.
- New dialog lives in `shared/components/dialog/`.
- Verified in a browser at `http://localhost:4100`, not just type-checked.

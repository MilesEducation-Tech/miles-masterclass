# Dialogs: the grey panel round the card, and the close button

Status: **approved and implemented (2026-10-30).** One ticket, one PR: `fix/MIL-161-dialog-panel-close-button` off
`master`.

## Goal

Every dialog looks like its design:

- **The dialog is only as wide as its card.** No grey band beside or behind it, at any width.
- **The close button is a 40 px dark disc that turns red on hover.** It is `bg-background/80` with
  `backdrop-blur-sm` and a 20 px rounded X. On hover it becomes `bg-destructive` with a white X. The same button is
  used in every dialog and drawer.

## What I read

- **`shared/ui/dialog/dialog.ts`:** the frame every dialog renders inside.
  - The centred panel is `w-full max-w-lg`, painted `bg-dialog` (`rgb(32, 32, 32)`) with `shadow-2xl`.
  - Almost every dialog passes `panelClass="p-0 …"` and draws its own card inside. Many also lift the cap
    (`max-w-full`, `max-w-[95vw]`) so a wide card fits.
  - Without the cap, `w-full` stretches the grey panel across the viewport and leaves the card in its middle or
    left part. That is the grey band in the screenshots.
- **Measured on the dev server (1440 px), the Share dialog:** the panel is 1403 px and grey; the card is 500 px.
  With `width: fit-content` on the panel, the panel is the card's 500 px at 375, 768 and 1440, with no sideways
  scroll.
- **Two dialogs already work round it, each on its own:**
  - `masterclass-course-info-dialog` and `video-dialog` pass `w-auto max-w-none`, and their comments describe
    this bug;
  - `cpe-compliance-dialog` passes `bg-transparent shadow-none`;
  - `utils-dialog`'s comment explains a width chosen "or the panel's grey background shows".

  The fix belongs in the shared frame instead.

- **`shared/ui/button/button.ts`:** it has no close variant. Every close button is `variant="ghost" size="icon"`,
  either with `rounded-full` (transparent, with a grey disc on hover) or with a per-dialog override:
  - the payment dialogs: transparent, with grey to white text on hover;
  - the masterclass course-info dialog: the dark disc with a red hover, written out in its own classes.
- **Every `<app-dialog>` call site (28):** its `panelClass`, its card's width classes and its close button. A
  harness in the dev app rebuilt each panel and card at 375, 768 and 1440 px and measured the panel against the
  card, before and after the fix.

## Locked decisions

1. **The panel fits its card.** The centred panel's `w-full` becomes `w-fit`. It keeps `max-w-lg`, which call sites
   can still lift, and keeps `bg-dialog`, the shadow and `p-6` for dialogs that use the plain frame. `fit-content`
   can't exceed the space available, so a long card still fills a phone.
2. **Drawers keep `w-full`.** Only the course filters drawer shows a strip, so it is fixed at its call site (5).
3. **The button gets a `close` variant:**
   - classes: `shrink-0 rounded-full bg-background/80 backdrop-blur-sm text-foreground data-hover:bg-destructive
data-hover:text-destructive-foreground data-press:bg-destructive/80`;
   - the variant draws its own 20 px `matCloseRound` icon, so each call site is
     `<button app-button type="button" variant="close" size="icon" aria-label="…" (click)="…"></button>`;
   - the focus ring stays, as on every other variant;
   - `@ng-icons/material-icons` is already a dependency.
4. **Every dialog's close button uses it.** Positioning classes stay (`absolute top-3 end-3 z-10`, etc.); colour
   overrides and the projected `heroXMark` go. Duplicate `size="sm"` attributes beside `size="icon"` go too.
   `heroXMark` and `NgIcon` leave a component's `providers`/`imports` only where nothing else in it uses them.
5. **Cards whose width depends on the panel get a definite width** (all measured in the harness):

   | Dialog                        | Today                                                                                                       | Change                                          |
   | ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
   | `subscription-dialog`         | card `w-[95svw] max-w-[min(100%,560px)]`: 808 px strip                                                      | card `w-[min(95svw,560px)]`                     |
   | `ai-lab-dialog`               | card `w-[95vw] max-w-[min(100%,48rem)]`: 600 px strip                                                       | card `w-[min(95vw,48rem)]`                      |
   | `course-info` (shared)        | card `w-10/12` on phones: 56 px strip                                                                       | `w-[84vw]`, as the masterclass course-info card |
   | `webinar-details-dialog`      | the same                                                                                                    | the same                                        |
   | `filter-dialog`               | card `w-full` on phones: would shrink 338 → 315 px                                                          | panel `w-full md:w-auto` (keeps today's widths) |
   | `micro-learning-filter-sheet` | 420 px card in a 512 px panel: 92 px strip; `w-full` on phones                                              | panel `w-full sm:w-fit` (full width on phones)  |
   | `course-filters-drawer`       | 384 px card in a 500 px drawer: 116 px strip; `w-screen` card scrolls sideways under the drawer's scrollbar | panel `p-0 max-w-sm`, card `w-full`             |
   - **Subscription and AI Labs keep their design widths (560 px, 48rem).** The `min(100%, …)` was added only to stop
     the card overflowing a phone. It can't size a panel that sizes itself by its card, because the percentage refers
     back to the panel. A definite width does the same job, and the global
     `app-dialog > [ngpDialog] > * { max-width: 100% }` rule keeps the card inside the panel on phones.
   - **The filter dialog and the micro-learning filter sheet stay full width on phones (intentional).** They don't
     shrink to their options.
   - **Every other card is unchanged.** Their classes are the design's own and already assume a panel that fits its
     card. That includes `certificate-download-dialog`, which fits its content up to 42rem.

6. **Comments that describe the old default are updated:** `masterclass-course-info-dialog`, `video-dialog` and
   `utils-dialog`. The first two lose the now-redundant `w-auto` from `panelClass`.
7. **Unchanged:**
   - `cpe-compliance-dialog`'s transparent panel;
   - the global search's inline X (it belongs to the search bar, not the dialog);
   - the shared `Dialog`'s own `closable` button (no caller uses it);
   - the drawers' widths.

## Target architecture

No new file and no new input. `Dialog` and `Button` (both `shared/ui`) change; every call site keeps its selector,
inputs and outputs.

## Endpoint map

None. This is styling only.

## Files touched (~50, ~220 lines)

- `shared/ui/dialog/dialog.ts`: the panel width.
- `shared/ui/button/button.ts` and `button.stories.ts`: the `close` variant and its story.
- **The close button (`.html`; `.ts` where the icon provider goes):**
  - `shared/dialogs/`: `share-dialog`, `course-info`, `calendly-dialog`, `filter-dialog`,
    `webinar-details-dialog`, `utils-dialog`, `ai-lab-dialog`, `ai-lab-terms-dialog`, `app-download-dialog`,
    `profile-completion-dialog`, `ai-lab-agent-dialog`, `video-dialog`;
  - `features/offerings/`: `micro-learning-about-panel`, `masterclass-course-info-dialog`, `html-content-dialog`,
    `webinar-registration-dialog`, `select-cpe-mode`;
  - `features/payment/dialogs/`: `coupon-dialog`, `address-dialog`, `subscription-dialog`, `cart-drawer-dialog`;
  - `features/tracker/cpe/dialogs/cpe-compliance-dialog`;
  - `features/library/course/components/course-filters-drawer`.
- **The widths in (5)**, in the same files: subscription, AI Labs, the shared course-info dialog, webinar
  details, filter, course filters drawer.
- `docs/refactor/STATE.md`: this entry, and MIL-132 marked merged (#215, `eddeb157`).

## Security

No data, auth or API change.

## Acceptance criteria

1. No dialog shows the grey panel beside, behind or round its card at 375, 768 or 1440 px. Measured: the panel's
   width equals the card's.
2. Cards keep today's width wherever there was no strip. The intentional changes are in (5); html-content,
   assessment-result and certificate download now fit their content, as their classes are written to (see Risks).
3. Every dialog and drawer close button is the 40 px dark disc with a 20 px X, red with a white X on hover, and
   keeps its focus ring.
4. Backdrop click and Escape still close dismissible dialogs; non-dismissible ones still don't.
5. No horizontal scroll inside any dialog at 375 px. The global search's existing 18 px overflow (its
   `min-w-[min(720px,95vw)]` against the 16 px overlay gutter) is out of scope.

## Checks

`pnpm lint`, `pnpm format:fix`, `pnpm build:prod`: the initial bundle must not grow beyond the `matCloseRound`
SVG, and Storybook must still build.

## How to verify (dev server, 4101)

- **Course page → Share** at 1440 / 768 / 375: the panel equals the card, the close button is the dark disc, and
  hover is red.
- **Masterclass page:**
  - a rail's filter icon: Filters dialog, full width on a phone;
  - a card's info icon: course info;
  - a trailer: video dialog.
- **Signed in:**
  - Watch Now on a locked course: subscription dialog;
  - cart drawer, coupon and billing address;
  - the CPE tracker's compliance dialog;
  - select CPE mode.
- **Course library at 768 → Filters:** the drawer is 384 px with no strip.
- **Webinar page → a webinar's details;** micro-learning → about and filter sheet; AI Labs dialogs.
- In each: hover the close button (red), click it (closes), and press Escape or click the backdrop where allowed.

## Risks

- **A card with `w-full` and short content now sizes to its content rather than the old stretched panel.** The harness
  found three, all written for a panel that fits its card:
  - `html-content-dialog`: still at least `50vw` on desktop;
  - `assessment-result-dialog`: at most 448 px, where today it has 26 px grey strips;
  - `certificate-download-dialog`: at most 42rem, where today it has a grey strip.

  Check them in the app.

- **A dialog not reachable without data** (certificate download, assessment result) is checked by the harness and
  the code, not by opening it in the app.
- **`matCloseRound` in `Button` puts one more icon in the initial bundle** (under 1 kB). `NgIcon` is already there.

## Assumptions

- The close button in the design is the same in every dialog and drawer, including the payment dialogs. Their
  current transparent style wasn't a design choice: it removed the ghost variant's grey hover square.

# Home cards: the "i" course-info button

Approved 2026-10-08. The first of two tickets from one request; the second is
`prompts/global-loading-bar.md`.

## Jira ticket

**Summary:** `feat(offerings): open the course-info dialog from the home cards`

**Issue type:** Story
**Component / scope:** offerings
**Branch:** `feat/MIL-XXX-home-course-info`
**Links:** relates to MIL-28 (the "i" dialog on `/masterclass`) · `prompts/home-course-info.md`

### Context

The `/masterclass` cards carry an "i" button that opens the course-info dialog (the course header
plus its About, from `course-detail/`). The home page renders the same card in its track rails, but
without the button.

### Current behaviour

`MasterclassCourseCard` (`shared/components/cards/masterclass-course-card/`) renders the button only
with `[showInfo]="true"`, and `features/home/pages/home/home.html` never sets it. It could not: the
dialog lives in `features/offerings/masterclass/dialogs/`, and one feature may not import another
(`boundaries/dependencies` counts a dynamic `import()` too).

### Expected behaviour

Every home rail card shows the "i" button. Clicking it opens the same dialog as on `/masterclass`.

### Scope

- In: the button and the dialog on the home cards.
- Out: the `/masterclass` page (unchanged), the hero slider's "Learn More" (legacy dialog).

### Acceptance criteria

- [ ] Home rail cards show the "i" button.
- [ ] Clicking it opens the dialog at once with the card's header, then its About from
      `course-detail/`.
- [ ] Watch Now goes to `/<country>/<profession>/masterclass/<id>/<slug>`.
- [ ] The dialog stays in its own lazy chunk; it isn't added to the home chunk.
- [ ] `/masterclass` "i" still works.
- [ ] `pnpm lint`, `pnpm build:prod` green (state the environment).

### How to verify

`pnpm start` (4101) → `/us/accounting/home` → the first rail → "i" on a card.

### Risks / assumptions / open questions

- Assumption: "More info" in the request is this "i" button. The cards have no other info control.

**Estimate:** S (< 100 lines)

## Approach

Reuse the inversion in `core/services/dialog/feature-dialog-tokens.ts` (`CART_DRAWER_DIALOG`,
`SUBSCRIPTION_DIALOG`). The token is bound in `app.config.ts`, the composition root, which may name
both sides. The `import()` stays at the binding, so the dialog stays lazy.

1. `core/services/dialog/feature-dialog-tokens.ts`: add `MASTERCLASS_COURSE_INFO_DIALOG`.
2. `app.config.ts`: bind it to the offerings dialog's `import()`.
3. Move `MasterclassCourseInfoDialogData` to `core/models/masterclass-home.model.ts`, beside
   `MasterclassCourse`, so home can type `open<…>()`. Update its importers.
4. `features/home/pages/home/home.ts`: `openCourseInfo(course)` through `NgpDialogManager` and the token.
5. `features/home/pages/home/home.html`: `[showInfo]="true" (info)="openCourseInfo($event)"`.
6. `masterclass-course-card.ts`: reword the `showInfo` doc.

The dialog needs nothing from the route:

- it provides its own `CourseDetailFacade`
- the course path comes from the root `Utils.getRouteParams()` signals

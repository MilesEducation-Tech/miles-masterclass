# One FAQ for the whole app

## Assumptions

1. **Ticket and branch.** The work goes on MIL-45 (`fix/MIL-45-webinar-faq-section-fix`) as a second commit. MIL-45 is
   the webinar FAQ fix, and this change is what that fix grows into. The PR description gets updated to match. If you
   want it tracked separately, make another subtask and I'll branch from this one.
2. **The data needs no change.** The shared `app-faq` and the webinar `app-webinar-faq` both render
   `resolveFaqData()` → `FAQ_DATA` (`core/constants/faq.ts`). The content is already the same: 5 categories, each
   holding its questions. Only the design differs. `FAQ_DATA2` in the same file is an older, flat copy of that list,
   and nothing imports it. It is left alone here (see Follow-ups).
3. **The support address is `support1@milesmasterclass.com`**, the one the webinar FAQ shows today. This was confirmed
   on 2026-10-09, even though the FAQ answers themselves name `support@` (26 times in the app).

## Goal

There should be one FAQ component, `app-faq` in `shared/components/faq/`, in the design the webinar pages show today:

- a centered heading and a support line
- a divider-style accordion with "+"/"−" icons
- two single-open levels, where opening a different category closes the question left open in the last one

Every page that shows an FAQ uses it, including the webinar list and detail pages. The webinar-only copy and the old
recursive `faq-item` go away.

## What I read

- **Shared FAQ:**
  - `shared/components/faq/faq.ts|html`. It is the old design: dark grey cards, a chevron, and an `sr-only` "Mode:
    Single/Multi" toggle that screen readers announce but nobody can see.
  - `shared/components/faq-item/faq-item.ts|html|css`. It recurses to any depth, keeps its own open state, and has a
    `fade-in` keyframe.
- **Webinar FAQ:**
  - `features/offerings/webinar/components/webinar-faq/webinar-faq.ts|html` (the design to keep).
  - `shared/ui/accordion/accordion-scope.ts` (the MIL-45 fix for nested `ngpAccordion` state).
- **Answer renderer:** `shared/components/faq-content/`, used unchanged by both FAQs and by `legal/`.
- **Data:** `core/constants/faq.ts` and `core/models/faq.model.ts`. `FAQ_DATA` is exactly two levels deep (5
  categories with `children`; no child has children), so a fixed two-level accordion renders all of it.
- **Hosts:**
  - `home` (inside `@defer … hydrate on viewport`, with a 416px placeholder)
  - `masterclass`, `masterclass-course`, `micro-learning`, `podcast`, `podcast-course`, `caira-landing` and `uae-caira`
    (embedded)
  - `connect-us` and the `/faq` route in `features.routes.ts` (standalone)
  - `webinar-list` and `webinar-detail` (`app-webinar-faq`)
- **Layout:**
  - `src/styles/styles.css`: `.container` is `container max-sm:w-11/12!`, so the old FAQ gave every host its horizontal
    fit.
  - The webinar list wraps its FAQ in `mx-auto w-11/12`.
  - The webinar detail page wraps it in nothing, so on a phone its text runs to the screen edge today.
- **Structure baseline:** `structure-baseline.json:32` allow-lists `faq-item.css` for its keyframes.

## Locked decisions

1. **One component, same address.**
   - The selector stays `app-faq`, the class `Faq`, and the folder `shared/components/faq/`. The 10 existing call sites
     don't change.
   - Its template and logic become the webinar FAQ's, including the `AccordionScope` fix.
2. **Inputs: `standalone` only.**
   - It keeps its meaning: `true` (the `/faq` route and connect-us) renders an `<h1>` and `pt-32`, and `false`
     renders an `<h2>`.
   - The webinar component's `heading`, `faqs` and `helpCentreUrl` inputs had no caller passing them, so they don't
     come across.
   - The sentence under the heading becomes "Still stuck? Write to support1@milesmasterclass.com."
3. **Heading levels follow the page.**
   - Category and question triggers sit in `role="heading"` wrappers with `aria-level` set to the FAQ heading's level
     plus 1 and plus 2.
   - So the `/faq` page reads h1 → 2 → 3, and an embedded FAQ reads h2 → 3 → 4, with no skipped level either way.
4. **The support address is a constant.** `FAQ_SUPPORT_EMAIL` (`support1@milesmasterclass.com`) goes in `core/constants/faq.ts`, next to the data it
   belongs to, not inline in the component.
5. **The wrapper keeps the old outer `container mx-auto`**, with the content inside capped at `max-w-4xl`.
   - Every existing host keeps the width the old FAQ gave it.
   - The webinar detail page gains the phone gutter it was missing.
6. **Deleted:**
   - `faq-item` (all three files). Its only user is `faq.html`.
   - `webinar-faq`. The webinar pages switch to `<app-faq [standalone]="false" />`.
   - The pruned `faq-item.css` baseline entry.
7. **Home placeholder.** The `@defer` placeholder on home is re-measured against the new collapsed height and updated,
   so the swap doesn't shift the layout.
8. **No data, model, renderer or API change.** `faq-content`, `faq.model.ts` and `FAQ_DATA` are untouched.
9. **The `/faq` route passes `data: { standalone: true }`** (found while verifying).
   - `withComponentInputBinding()` sets an input with no matching route data to `undefined`, which overrides the
     `true` default.
   - So on `master`, `/faq` rendered an `<h2>` with no top padding, and its heading slid under the fixed header.
   - `/mobile/faq` (the plain layout, with no header) is left as it is today: an `<h2>` with no padding.

## Target architecture

```
shared/components/faq/faq.ts      Faq: standalone input, items = resolveFaqData(country, profession),
                                  openId/openChildId signals, openCategory()/openQuestion()
shared/components/faq/faq.html    header (h1|h2 + support line) → ngpAccordion (categories)
                                    → appAccordionScope → ngpAccordion (questions) → app-faq-content
shared/ui/accordion/accordion-scope.ts   unchanged
```

## Endpoint map

None. The FAQ is static TypeScript data.

## Phases

One phase. This is a single commit of about +150 / −420 lines, most of the removed lines being the two deleted
components.

1. Rewrite `faq.ts` and `faq.html` from `webinar-faq`, applying decisions 2–5.
2. Add `FAQ_SUPPORT_EMAIL` to `core/constants/faq.ts`.
3. Switch `webinar-list` and `webinar-detail` (`.ts` imports and `.html` tags) to `Faq`.
4. Delete `faq-item/` and `webinar-faq/`, then run `node scripts/check-structure.mjs --prune`.
5. Measure the collapsed FAQ on home at 375 / 768 / 1440 px and set the placeholder height.

## Files touched

| File                                                                                    | Change                             |
| --------------------------------------------------------------------------------------- | ---------------------------------- |
| `src/app/shared/components/faq/faq.ts`                                                  | rewritten                          |
| `src/app/shared/components/faq/faq.html`                                                | rewritten                          |
| `src/app/core/constants/faq.ts`                                                         | `+ FAQ_SUPPORT_EMAIL`              |
| `src/app/shared/components/faq-item/faq-item.{ts,html,css}`                             | deleted                            |
| `src/app/features/offerings/webinar/components/webinar-faq/webinar-faq.*`               | deleted                            |
| `src/app/features/offerings/webinar/pages/webinar-list/webinar-list.{ts,html}`          | `WebinarFaq` → `Faq`               |
| `src/app/features/offerings/webinar/pages/webinar-detail/webinar-detail.{ts,html}`      | `WebinarFaq` → `Faq`               |
| `src/app/features/home/pages/home/home.html`                                            | placeholder height (if it changed) |
| `structure-baseline.json`                                                               | pruned `faq-item.css` entry        |
| `src/app/features/features.routes.ts`                                                   | `/faq` route data (decision 9)     |
| `src/app/shared/dialogs/ai-lab-agent-dialog/ai-lab-agent-about/ai-lab-agent-about.html` | comment pointed at `faq-item`      |

## Security

- **Nothing new reaches the browser.** The answers still go through `faq-content`, whose `rich` variant trusts only
  typed TypeScript constants.
- **The `mailto:` is a constant**, never user input.

## Acceptance criteria

1. **One component.** Every page that showed an FAQ shows the new design, and no `app-webinar-faq` or `app-faq-item`
   remains anywhere.
2. **Opening and closing:**
   - Clicking a category opens it.
   - Clicking it again closes it.
   - Opening a different category closes the first one and clears the question that was open inside it.
   - Questions open one at a time within their category.
3. **Keyboard:**
   - Enter and Space toggle the focused trigger.
   - Arrow keys move between triggers at the same level.
4. **Headings:**
   - `/us/accounting/faq` has exactly one `<h1>` (the FAQ heading).
   - Home and the course pages have no `<h1>` coming from the FAQ.
   - Heading levels don't skip.
5. **Layout:**
   - At 375px the FAQ has a side gutter on every host, including the webinar detail page.
   - Home shows no layout shift when the deferred FAQ swaps in.
6. **Checks:**
   - `pnpm lint` passes with 0 errors.
   - `pnpm build:prod` passes with no new warnings.
   - The structure check passes after the prune.

## Checks

```bash
pnpm lint
pnpm format:fix
pnpm build:prod
```

Restart `pnpm start` after the build. A build run alongside the dev server leaves its Vite dependency cache stale.

## How to verify

1. Run `pnpm start`, then open each page:
   - `/us/accounting/webinar`
   - a webinar's detail page
   - `/us/accounting` (home)
   - `/us/accounting/masterclass`
   - `/us/accounting/podcast`
   - `/us/accounting/faq`
   - `/us/accounting/connect-us`
2. On each page, check that the FAQ has the webinar design and that criteria 2–4 hold.
3. Check the layout at 375 / 768 / 1440 px.

## Risks

- **This is a visual change on about ten pages.** Intentional differences:
  - Dividers replace the grey cards.
  - "+"/"−" replaces the chevron.
  - The staggered fade-in of the questions is gone.
  - The heading is centered and gains the support line.
  - The hidden "Mode" toggle is gone.
- **Narrower on phones on the webinar list.** At 375px the webinar list's FAQ becomes about 8% narrower, because
  `container` takes 11/12 of a parent that is already 11/12. Every other host keeps its current width.
- **Light-on-dark hosts.** The new markup uses theme tokens (`border-border`, `text-muted-foreground`, `text-accent`)
  instead of `text-white`/`bg-gray-800`. Every host page is dark today, so this is checked by eye, not assumed.

## Follow-ups (not in this change)

- **`FAQ_DATA2`** (about 935 lines in `core/constants/faq.ts`) is the old, flat FAQ list and has no importer. It can be
  deleted in its own `chore`.

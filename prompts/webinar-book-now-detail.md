# Guest "Book Now" opens the webinar's page with its seat form focused

## Assumptions

1. **Same branch as MIL-62.** It is a separate bug from the sign-in gates, but it ships in the same PR on
   `fix/MIL-62-require-sign-in` (the user's decision, 2026-10-12).
2. **Only the signed-out "Book Now" on the list changes.** Signed in, the same button reads "Register Now" and still
   registers in place. The detail page's own buttons, the home ticket and Join are unchanged.

## Goal

Signed out, "Book Now" on any row of `/webinar` opens **that** webinar's detail page with the "Email or phone" field of
its "Secure Your Seat" form focused.

## What I read

- **`webinar-list.ts` `onRegister`:** signed out, with a hero on the page, it scrolls to `#seat-identifier` and focuses
  it. That field is in the hero's seat form, `<app-seat-form [webinarId]="hero.id">`.
  - **Bug:** this books the hero webinar, not the row that was clicked. Book Now on "Digital Transformation of CPA
    Firms", then filling in the form, books "Kaun Banega CPA".
- **`webinar-hero.html`:** the guest branch always renders the seat card for its own webinar. So the detail page of
  any webinar carries the right form.
- **`seat-form.ts`:** it reads `GuestRegistration`, and the field `#seat-identifier` is an `input[app-input]`
  (an attribute component).
- **`WebinarFacade`:** it is provided on the webinar feature's parent route, so the list and the detail page share one
  instance. `join()` (MIL-62) already builds the absolute webinar path from `Utils`.
- **Router:** `withInMemoryScrolling({ scrollPositionRestoration: 'top' })` and `withViewTransitions()`. A new page
  starts at the top, which on a phone is above the seat card.

## Locked decisions

1. **`WebinarFacade.book(webinarId)` decides.**
   - Signed in: `register(webinarId)`, as today.
   - Signed out: remember `webinarId` as the seat form to focus, then navigate to
     `['/', country, profession, 'webinar', webinarId]`.
   - The list page's `onRegister` becomes a one-line call into it. Its `focusSeatForm()` and `window` injection are
     deleted.
2. **The focus request is a one-shot signal in the facade, not navigation state or a URL parameter.**
   - `takeSeatFocus(webinarId)` returns `true` once, for that webinar only, then clears.
   - So a refresh, a shared link or a later visit never steals focus.
   - Both pages already share the facade, so nothing is passed through the hero (the "components inject the facade"
     rule).
3. **`SeatForm` focuses itself.**
   - After its first render, if `takeSeatFocus(webinarId())` is `true`, it scrolls the field to the centre
     (`scrollIntoView({ block: 'center' })`) and focuses it with `preventScroll`.
   - This is the same scroll-then-focus the list did, so on a phone the field is visible as well as focused. The OTP
     step's `autoFocus` is unchanged.
4. **The webinar path builder is shared.** A private `webinarPath(id, ...rest)` in the facade is used by `join()`
   (`…, 'live'`) and `book()`, so the two can't drift.

## Endpoint map

None. No request is added, removed or changed. Registration still goes through `GuestRegistration` on the detail
page.

## Files touched

| File                                                                     | Change                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------- |
| `src/app/features/offerings/webinar/services/webinar-facade.ts`          | `book()`, `takeSeatFocus()`, `webinarPath()`    |
| `src/app/features/offerings/webinar/pages/webinar-list/webinar-list.ts`  | `onRegister` → `facade.book()`; drop focus code |
| `src/app/features/offerings/webinar/components/seat-form/seat-form.ts`   | focus on arrival                                |
| `src/app/features/offerings/webinar/components/seat-form/seat-form.html` | `#identifier` template ref                      |

## Acceptance criteria

1. **Signed out, Book Now on any list row** opens `/…/webinar/<that id>`. Its "Email or phone" field is focused and on
   screen at 375, 768 and 1440 px.
2. **The form on that page books the clicked webinar.** Its seat form carries that webinar's id.
3. **No focus without a click.** A refresh of that page, a direct link to it, or "More Info" does not focus the field.
4. **Signed in, the row's button** ("Register Now") registers in place, as today.
5. **Gates:** `pnpm lint` 0 errors; `pnpm build:prod` green with no new warnings.

## How to verify

1. **Signed out, `/us/accounting/webinar`:**
   - Click Book Now on the second row. The URL becomes that webinar's id, the hero shows its title, and
     `document.activeElement.id === 'seat-identifier'`.
   - Repeat at 375 px. The field is in view.
2. **No click:** reload that page, and open "More Info" from the list. No field is focused.
3. **Dummy session cookie:** Book Now is "Register Now" and does not navigate.

## Risks

- **Focus timing against the router's scroll-to-top.** If the router's scroll runs after the focus, the field ends
  up focused but off screen on phones. This is checked at 375 px. If it happens, the focus waits for the router's
  `Scroll` event.
- **A phone keyboard opens on arrival.** That is what "focused" means on a phone, and it is what was asked for.

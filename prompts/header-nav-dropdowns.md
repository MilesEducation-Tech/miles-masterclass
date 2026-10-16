# MIL-93: header dropdowns close when another menu or nav link opens

## Goal

The desktop header shows one dropdown at a time and always opens it collapsed:

- Opening the profile menu, or any other nav item, closes an open dropdown.
- A dropdown never reopens with a sub-menu (Resources → Library) already expanded.

Branch `fix/MIL-93-header-nav-dropdowns`, from `master` 3.7.0.

## Assumptions (read first)

1. **Escape closes an open dropdown and returns focus to its trigger.** That's new: today nothing handles Escape
   here. I wrote "still" in the ticket, which was wrong. It's in scope because the old menu primitive did it, and a
   dropdown that only a mouse can close is a keyboard trap in practice. Say if you want it left out.
2. **A route change also closes it.** This covers navigation that isn't a click inside the header, such as Back or
   a link elsewhere on the page. The header already closes the mobile drawer the same way.
3. **The mobile drawer is out of scope.** It renders its own list, and its sub-panels reset when it closes because
   they're destroyed. Nothing about it changes.

## What I read

- **`layout/header/header.ts|html`:** the desktop nav is a single `ngpAccordion` (`openNavItem`,
  `onNavOpenChange`, `closeNavDropdown`). `onDocumentClick` closes it only when the click is outside the header host.
  The header provides `NavMenuGroup` for the sub-menus inside its dropdowns.
- **`shared/components/nav-menu-item`:** a sub-menu is an `ngpCollapsible` whose open state is linked to the
  sibling `NavMenuGroup`. It releases the group only on its own close or when destroyed.
- **`shared/components/user-avatar-menu`:** an `ngpMenu`, which closes itself on an outside press and on Escape.
- **ng-primitives 0.131:** an open accordion item carries `data-open` (from its collapsible core).
  `ngpAccordionContent` stays in the DOM while closed, which is why a sub-menu's state survives a close.

## Root causes

1. **"Outside" means outside the header.** The avatar menu and the plain nav links (Masterclasses, AI Lab…) are
   inside the header, so clicking them never closes the open dropdown.
2. **Closing the dropdown doesn't reset its sub-menus.** The content stays mounted and the header's `NavMenuGroup`
   keeps `open = 'Library'`, so reopening Resources shows Library expanded.

## Change (header only)

- **`onDocumentClick`:** while a dropdown is open, close it unless the click lands inside the _open item_ (its
  trigger or its panel). A click on another dropdown's trigger stays with the accordion, which already switches
  (single mode).
- **`closeNavDropdown()` and every change of the open item** (switching, or closing by its own trigger) reset the
  header's `NavMenuGroup` (`open.set(null)`), so a dropdown always opens collapsed.
- **Escape** (`keydown.escape` on the desktop nav) closes the open dropdown and moves focus back to its trigger.
- **The route-change effect** that closes the drawer also closes the dropdown.
- **No change** to `nav-menu-item`, `user-avatar-menu` or the drawer. The fix lives where the dropdown state lives.

## Files touched

- `src/app/layout/header/header.ts`
- `src/app/layout/header/header.html` (a template ref on the nav list, and the Escape binding)
- `docs/refactor/STATE.md`

About 40 changed lines.

## Acceptance criteria

1. Resources open → click the avatar: Resources closes and the profile menu opens. The reverse also leaves only
   one open.
2. Resources open → click Masterclasses, AI Lab, Webinar or any nav link: the dropdown closes (and the page
   navigates).
3. Resources → Library open → close by any means → reopen Resources: Library is collapsed.
4. Resources open → open another dropdown: one closes, the other opens (as today).
5. Clicks inside the open panel (Library's trigger, a sub-menu) keep it open; a link inside it still navigates
   and closes it.
6. Escape closes the open dropdown and focus returns to its trigger. An outside click still closes it.
7. The mobile drawer behaves as before.

## Checks

`tsc`, `pnpm lint` (structure included), `pnpm format`, `CI=true pnpm build:prod`.

## How to verify

Dev 4101, signed in (or a dummy `ACCESS_TOKEN` so the avatar shows), at 1440 and 1024: run each acceptance case,
with the keyboard too (Tab to Resources, Enter, Escape). At 768 the drawer shows instead; open it and its Library
sub-menu once, to confirm the drawer is unchanged.

## Risks

- **`data-open` is an ng-primitives attribute.** If a future version renames it, the inside check silently
  treats every click as outside. Mitigated by matching the open item by its `value` rather than the attribute, if
  the template exposes it (decided while building).
- **Focus return on Escape** must not fire when no dropdown is open, or Escape would steal focus on the page.

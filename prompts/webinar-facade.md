# Webinar: pages and components go through `WebinarFacade`

**Status:** implemented 2026-10-15 on `refactor/MIL-XXX-webinar-facade`, stacked on `fix/MIL-88-profile-leave-dialog`.
The user asked for it directly ("fix the webinar facade issues") after `prompts/facade-audit.md` priority-1 item 3.

## Jira

```
Summary: refactor(offerings): route the webinar pages through WebinarFacade
Issue type: Tech debt · Component: offerings · Branch: refactor/MIL-<n>-webinar-facade
Context: the facade audit found the webinar pages bypassing WebinarFacade: both pages injected WebinarRegistration and
         relayed its in-flight set down through the rail as inputs, the join logic was written twice, the detail page
         merged the feed and detail rows itself, and the facade carried two members nobody read.
Expected: the facade owns registration state, join and the detail merge; no behaviour change.
Estimate: S
```

## Decisions

- **D1 Registration state:** the card and the hero read their own row's state with `WebinarFacade.isRegistering(id)`.
  The pages stop injecting `WebinarRegistration`, and the `isRegistering` / `registeringIds` inputs are deleted from
  the hero, the card and the rail.
- **D2 Join:** `WebinarFacade.join(id, from)` replaces the two `onJoin` copies. `from` is the calling page's route; both
  pages are children of the feature root, so the live room is `[id, 'live']` relative to `from.parent`. It resolves
  the target from `detailFor(id)`, so a deep-linked detail page (no feed row) still finds its registration.
- **D3 Detail merge:** `WebinarFacade.detailFor(id)` returns `{ webinar, bucket }`, the code the detail page held. It
  ignores a detail row for another id, which the page could show while the router reuses it for the next webinar.
- **D4 Dead code:** `isEmpty` is deleted. `isRegistering` now has its two readers.
- **D5 Kept as outputs:** `register` and `join` still bubble from the card through the rail to the page. The list page
  applies a page rule to register (a guest is taken to the hero's seat form), and join needs the page's route.
- **D6 Aliases** in every file touched; the relative-import baseline is pruned by three entries.

## Verified (dev on 3000, signed in, no register or join sent)

- Detail page `/us/accounting/webinar/de7eff9b-…`: server-rendered hero, browser render from the detail row, bucket
  `highlight`, CTA "Register Now". Marking the id in flight through the registration service turns the hero's CTA
  into a disabled "Booking…", and clearing it brings "Register Now" back.
- `join` with an unknown id shows "That session is not ready yet" and stays on the page. The live-room URL built
  from the detail page and from the list page is the same `/us/accounting/webinar/<id>/live`.

## Found, not fixed here (pre-existing)

- **The landing feed fails its contract check on UAT.** Six `missed_webinar` rows carry `horizontal_thumbnail: null`
  and `square_image: null`; `isWebinarCard` requires both to be strings, so one row fails the whole feed and the list
  page shows "We could not load the webinars". The card and hero already fall back across the three images, so the
  fix is `isStrOrNull` on both keys and `string | null` on the type, in its own `fix(offerings)` commit.
- `isLockedElsewhere` on the hero and card is never bound, so the `live-elsewhere` CTA state is unreachable.

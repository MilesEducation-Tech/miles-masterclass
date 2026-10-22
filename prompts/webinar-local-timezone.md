# MIL-118: show webinar session times in the viewer's local timezone

Status: **approved and implemented (2026-10-22).** Branch `fix/MIL-118-webinar-local-timezone`, off `master` (`5fa11a28`).

## Goal

Webinar pages convert the API's UTC `start_date_time` to US Eastern for every viewer. A session at
`2026-10-22T12:00:00+00:00` reads "22nd Oct 2026 | 8:00 AM (EDT)" to a learner in India, who has to do the
conversion in their head. Each viewer should see the date, time and zone label in their own timezone:
"22nd Oct 2026 | 5:30 PM (IST)" in India, "8:00 AM (EDT)" in New York, "4:00 PM (GST)" in Dubai.

## What I read

- `features/offerings/webinar/utils/session-time.ts`:
  - `SESSION_TIMEZONE = 'America/New_York'` pins every label.
  - `sessionParts()` and `formatSessionLabel()` resolve month, day, ordinal, year, time and the `EST`/`EDT` label in
    that zone.
- **The callers.**
  - `webinar-card` (`.ts`/`.html`):
    - the desktop date pill (`parts.month`, `parts.day`, `parts.time (parts.zone)`);
    - the guest row (`date: 'MMMM' : parts.zone`, `parts.day`, `parts.ordinal`, `parts.year`);
    - the mobile `sessionLabel`.
  - `webinar-hero` (`.ts`/`.html`): `sessionLabel` in the member banner and on the guest ticket.
  - No other file imports `SESSION_TIMEZONE`, `sessionParts`, `formatSessionLabel` or `dayOrdinal`.
- **Not affected:**
  - The countdown, the "starts in" chip and the CTA state machine (`webinar-status.ts`) work on epoch ms, which has
    no zone.
  - The live page's `date: 'shortTime'` is already local.
- **The rest of the app already does this.** `shared/pipes/local-time-zone/local-time-zone-pipe.ts` (`localTimeZone`)
  pairs with a zone-less `DatePipe` to print the viewer's own label ("IST", "GST", "EDT"). Three surfaces use it:
  - the home page's webinar ticket;
  - the UAE CAIRA page;
  - the shared webinar details dialog.

  The webinar pages are the only surface pinned to New York.

- **History.**
  - `prompts/webinar-v3-parity.md` asked for "the visitor's zone (… `localTimeZone` behaviour)".
  - The Events v1 rebuild (`cb635d15`, 2026-09-23) pinned New York instead. Its stated reason was that Node and
    the browser then render the same string.
- **Render mode.**
  - `app.routes.server.ts`: the webinar list and detail pages are server-rendered on purpose (crawlers see the
    `pre_login` feed). Only `webinar/*/live` is client-only.
  - The hero is not deferred. The card rails sit in `swiper-strip`'s `@defer (on idle)`, so the server sends only
    their placeholder.
- **`Intl` on a UTC host** (Vercel's functions run in UTC). The zone's long name is "Coordinated Universal Time", so
  `localTimeZone`'s initials rule prints **"CUT"** in server HTML today (the home ticket included).

## Locked decisions

1. **The viewer's zone, from the device.** Format with no `timeZone`, so `Intl` and `DatePipe` use the runtime's
   own zone. The API sends no per-webinar zone and none is needed: the instant is in UTC.
2. **One label rule app-wide: reuse `localTimeZone`.**
   - The templates print the label with the existing pipe, so the webinar pages and the home ticket can't disagree
     ("IST" on one, "GMT+5:30" on the other, which is what `timeZoneName: 'short'` gives under `en-US`).
   - This also follows the review rule "use pipes in templates, reuse what exists".
   - `SessionParts.zone` and the `(EST)` suffix inside `formatSessionLabel()` go. The template appends
     ` ({{ start | localTimeZone }})` instead.
3. **Server HTML renders in the server's zone; hydration switches it to the viewer's.**
   - The server can't know the viewer's zone. Angular hydration re-evaluates text bindings on the first client
     change detection, so the browser's value replaces the server's. Text isn't part of the hydration structure
     check, and the `@if` branches are the same on both sides, so there is no mismatch.
   - Before hydration, the page reads e.g. "12:00 PM (UTC)" for a moment, then "5:30 PM (IST)". Both are true
     statements of the same instant.
   - The home ticket behaves exactly like this today.
4. **The server label says "UTC", not "CUT".** A two-line special case goes in `LocalTimeZonePipe`. It fixes the
   webinar pages' server HTML and, as a side effect, the home ticket's and UAE CAIRA's.

## Assumptions (the reviewer's first stop)

- **The crawler / first-paint version may be UTC.** I'm assuming this is fine.
  - The alternative keeps the server on Eastern and switches only in the browser. That needs a zone parameter
    threaded through `sessionParts`, the pipe and both components, for a label that shows for under a second.
  - Say if you want it.
- **A device set to the wrong zone shows the wrong local time.** Zoom invites and calendars behave the same; there
  is no better source in the browser.

## Target shape

```ts
// session-time.ts: no SESSION_TIMEZONE. Every part resolves in the runtime's own zone.
export interface SessionParts {
  month;
  day;
  ordinal;
  year;
  time;
} // `zone` removed
export function sessionParts(iso) {
  /* Intl.DateTimeFormat('en-US', { month: 'short' }) … no timeZone */
}
export function formatSessionLabel(iso); // "22nd Oct 2026 | 5:30 PM" (no zone suffix)
export function dayOrdinal(iso); // the unused `timeZone` parameter goes; it always matches the local render
```

```html
<!-- webinar-card / webinar-hero -->
{{ session }} ({{ w.start_date_time | localTimeZone }}) {{ parts.time }} ({{ w.start_date_time |
localTimeZone }}) {{ w.start_date_time | date: 'MMMM' }}
<!-- the zone argument goes -->
```

## Endpoint map

None. No API change; `start_date_time` is already an ISO instant with `+00:00`.

## Files touched (~50 lines)

| File                                                                   | Change                                                                                                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/offerings/webinar/utils/session-time.ts`                     | Drop `SESSION_TIMEZONE` and `SessionParts.zone`; resolve parts locally; label without the zone; `dayOrdinal(iso)`; comments rewritten to say "the viewer's zone" |
| `features/offerings/webinar/components/webinar-card/webinar-card.ts`   | Import `LocalTimeZonePipe`; doc comments say `IST`, not `EST`                                                                                                    |
| `features/offerings/webinar/components/webinar-card/webinar-card.html` | Pill and mobile label use `localTimeZone`; guest row's `date: 'MMMM'` loses `: parts.zone` and its comment                                                       |
| `features/offerings/webinar/components/webinar-hero/webinar-hero.ts`   | Import `LocalTimeZonePipe`; doc comment                                                                                                                          |
| `features/offerings/webinar/components/webinar-hero/webinar-hero.html` | Both `{{ session }}` lines append the pipe                                                                                                                       |
| `shared/pipes/local-time-zone/local-time-zone-pipe.ts`                 | "Coordinated Universal Time" → `UTC`                                                                                                                             |

Not touched: the countdown, `webinar-status.ts`, the live page, the home ticket, UAE CAIRA, the details dialog.

## Phases

1. `session-time.ts`: drop the pin and the zone part.
2. The card and the hero: the pipe in the template.
3. The pipe: the UTC label.
4. Gates, then verify in the dev server and in an SSR build.

## Security

No new input, request or storage. The zone comes from the browser's own `Intl` and is used only for display.

## Acceptance criteria

- **Same session (`2026-10-22T12:00:00Z`), by viewer zone:**
  - Asia/Kolkata: "22nd Oct 2026 | 5:30 PM (IST)"
  - America/New_York: "8:00 AM (EDT)"
  - Asia/Dubai: "4:00 PM (GST)"
  - Europe/London: "1:00 PM (BST)"
- **A session that crosses midnight** (`23:30Z`) shows the next day's month, day, ordinal and year in India. All the
  parts agree with each other.
- **After 1 Nov 2026,** New York viewers see `EST`, with no code change.
- **Countdowns and Join timing** are unchanged.
- **SSR on a UTC host:** the server HTML says `(UTC)`. In the browser it becomes the viewer's label, with no
  hydration warning in the console.
- **The home ticket** and the webinar pages print the same label for the same viewer.

## Checks

```bash
pnpm lint
pnpm format:fix
pnpm build:prod
```

## How to verify

1. **Dev server** (`pnpm start`, port 4101), with the browser emulating each zone above (Playwright `timezoneId`):
   - Check the webinar list cards (desktop pill, guest row, mobile label).
   - Check the detail hero (member banner and guest ticket).
   - Check the home ticket.
   - Do it at 375, 768 and 1440 px. The pill now holds labels of other lengths ("IST", "AEDT", a raw "GMT+3"), so
     check it doesn't wrap badly.
2. **SSR:**
   - Run `pnpm build`, then `TZ=UTC pnpm serve:ssr:miles-masterclass-v3`.
   - `curl` a webinar detail page and confirm the server HTML carries `(UTC)`.
   - Open the same page in a browser emulating Asia/Kolkata. Confirm it reads `(IST)` after hydration and the console
     has no `NG0500`-family warning.
3. **UAT fallback:** if UAT is down, use whatever session the feed returns. The check is that the label matches the
   viewer's zone, not the specific time.

## Risks

- **Brief change at hydration** (server zone → viewer zone) on the hero. The same behaviour the home page has
  shipped with.
- **Search results** may quote the UTC time from the server HTML. The structured data, if any, uses the ISO instant
  and is unaffected.
- **Label length** varies by zone; the desktop pill is the tightest spot (checked in step 1).

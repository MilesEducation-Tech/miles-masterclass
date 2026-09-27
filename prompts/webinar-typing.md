# Webinar typing: make the Events types match the Postman contract exactly

Two PRs, two tickets. Each is cut from `origin/master` once the previous one is committed.

| PR  | Branch                                              | Commit                                                                        | Target size                  |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------- |
| A   | `refactor/MIL-XXX-webinar-drop-off-contract-fields` | `refactor(offerings): drop webinar fields the Events API never sends`         | ~250 lines, mostly deletions |
| B   | `refactor/MIL-XXX-webinar-strict-contract-types`    | `refactor(offerings): parse the webinar feed and detail against the contract` | ~300 lines                   |

**Decision (yours, 2026-09-27):** remove the off-contract fields from both the types and the UI. Each one comes back, typed, when the backend ships it. The embedded Meeting SDK path (`liveEnabled: false`) stays; only its own `meeting-session.model.ts` keeps `registrant_token`.

**Out of scope:** the legacy routes (`webinar/filter/?type=futured` in `home`, feedback `webinar/details/` + `user-feedback/*`, `v2/webinar-badges/` in tracker/caira). They live in other features and need the backend's answer first; they'll go in their own tickets.

---

## PR A: drop the fields the Events API never sends

### Jira ticket A

> **Summary:** `refactor(offerings): drop webinar fields the Events API never sends`
> **Issue type:** Tech debt · **Component / scope:** offerings (webinar) · **Branch:** `refactor/MIL-<n>-webinar-drop-off-contract-fields`
> **Links:** Postman `06. Events and Bookings` (card contract §8, details page) · `prompts/webinar-typing.md` · follows MIL-7
>
> **Context:** `webinar.model.ts` declares 16 fields as optional that the new Postman contract doesn't have. Because they're optional, the compiler can't flag them, and the UI blocks they feed are always empty: the NASBA disclosure lines, the "to earn CPE" rules, the revision dates, the credential badge slot, the server-clock offset and the server join-window override.
>
> **Current behaviour:** The types promise data that never arrives. Code reads `undefined` and renders nothing, so it's dead UI that looks alive to the next developer.
>
> **Expected behaviour:** The types describe only what the contract sends. The dead UI and its plumbing are deleted. The visible page doesn't change, because none of it ever rendered.
>
> **Scope:**
>
> - In: the fields and consumers listed in the prompt.
> - Out: the live/SDK path, the legacy routes, and the parse guards (ticket B).
>
> **Acceptance criteria:**
>
> - [ ] None of these are declared or read anywhere in `features/offerings/webinar/`: `badge_icon_url`, `int_delivery_method`, `program_level`, `prerequisite_education`, `advance_preparation`, `course_created_date`, `course_reviewed_date`, `course_updated_date`, `no_question_answered`, `attendance_threshold`, `server_time`, `join_opens_at`, `registrant_token` (outside `meeting-session.model.ts`).
> - [ ] `description` exists only on `WebinarDetail`.
> - [ ] The list and detail pages look identical before and after at 375, 768 and 1440 px (checked with `?preview=design`).
> - [ ] `pnpm lint`, `pnpm ng test --watch=false` and `pnpm build:prod` pass.
>
> **Backend follow-ups (each re-adds a field when it ships):** the NASBA disclosure fields on the events serializer, `badge_icon_url`, `server_time`, `join_opens_at`, and `registrant_token` (WEBINAR_API_QUESTIONS Q3, Q5, Q6).
>
> **Estimate:** M

### Changes (A)

| File                                              | Change                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models/webinar.model.ts`                         | **`WebinarCard`:** delete `badge_icon_url`, the 10-field NASBA group, and `description` (it moves to `WebinarDetail` as `description: string \| null`). **`WebinarRegistrationInfo`:** delete `registrant_token` and `join_opens_at`. **`WebinarMainPageData`:** delete `server_time`. **`AttemptStatusResponse`:** delete `registrant_token`. Update the header comments that promise these fields. |
| `components/webinar-about/webinar-about.ts\|html` | Delete `revisionDates`, `earningRules` and their template blocks. `disclosures` keeps only the constant Sponsor ID row, the one row that renders today. `summary` reads `description` only when the input is a `WebinarDetail`: `'description' in w`, narrowed with a type guard, not a cast.                                                                                                        |
| `components/webinar-card/webinar-card.ts\|html`   | Delete the `badge` computed and its always-empty slot.                                                                                                                                                                                                                                                                                                                                               |
| `utils/webinar-status.ts` (+ spec)                | `joinOpensAt` uses only the local `start − joinWindowMinutes`. Delete the server-override branch and its spec. Correct the "50-minute" comment to match the config (15).                                                                                                                                                                                                                             |
| `services/server-clock.ts`                        | Delete `offsetMs` and `syncFrom`; `now()` becomes `Date.now()`. Keep the class, because the single ref-counted 1 s ticker is still its job. Update the doc comment.                                                                                                                                                                                                                                  |
| `services/webinar-facade.ts` (+ spec)             | Delete the `clock.syncFrom(...)` call and the spec assertion that the clock is synced from the feed.                                                                                                                                                                                                                                                                                                 |
| `services/webinar-registration.ts`                | Delete `registrantToken` from the outcome type and all five places it's built. Nothing reads it.                                                                                                                                                                                                                                                                                                     |
| `utils/webinar-preview.ts`                        | Delete the removed fields from the preview fixtures, and the `BADGE` / NASBA constants if they're left unused.                                                                                                                                                                                                                                                                                       |

**Why this is a refactor, not a fix:** nothing visible changes. Every deleted line rendered nothing, because its input was always `undefined`.

---

## PR B: strict contract types for the webinar feed and detail

### Jira ticket B

> **Summary:** `refactor(offerings): parse the webinar feed and detail against the contract`
> **Issue type:** Tech debt · **Component / scope:** offerings (webinar) · **Branch:** `refactor/MIL-<n>-webinar-strict-contract-types`
> **Links:** Postman `06. Events and Bookings` · `prompts/webinar-typing.md` · follows ticket A
>
> **Context:** The feed and detail responses are cast (`raw as WebinarMainPageResponse`), so a contract change compiles fine and renders `undefined`. One `WebinarCard` type covers every bucket, even though `registration` exists only on upcoming/highlight rows (signed-in) and `eligible` only on completed rows. Error codes are typed `string`.
>
> **Expected behaviour:**
>
> - Each response is checked once, at the resource's `parse`.
> - Each bucket has its own card type.
> - Fields the contract always sends are required. Fields that can be `null` are typed `T | null`, never `?`.
> - Error codes are a documented union that still accepts new codes.
>
> **Acceptance criteria:**
>
> - [ ] No `as WebinarMainPageResponse` / `as WebinarDetailsResponse` casts are left.
> - [ ] A malformed feed puts `loadError()` in its error state. A malformed detail puts the page in its error state.
> - [ ] `completed_webinar` rows are typed with `eligible: boolean`, and no other bucket type has it.
> - [ ] `WebinarError.code` and `error_code` are `WebinarErrorCode`.
> - [ ] Specs feed the verbatim Postman example bodies (main page 200 / 400 / 401, details 200 / 404) through the parsers.
> - [ ] lint, test and build pass.
>
> **Estimate:** M

### Changes (B)

| File                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models/webinar.model.ts`                | **Per-bucket cards.** `WebinarCard` is the shared base. Add `UpcomingWebinarCard = WebinarCard & { registration?: WebinarRegistrationInfo }` (`?` is correct here: the block is absent on `pre_login`) and `CompletedWebinarCard = WebinarCard & { eligible: boolean }`. `WebinarMainPageData` types each bucket with its own card type. `FeedCard = UpcomingWebinarCard \| CompletedWebinarCard \| WebinarCard` is what `ctaFor` and the card components take. **Required vs nullable:** `subject_details: WebinarSubjectDetails \| null`, `level_details.level_id: string`, and on `WebinarDetail`: `description`, `trailer_url`, `trailer_thumbnail_url` (`string \| null`) and `product: WebinarProduct \| null`. Remove the "undocumented" comments (documented since 2026-09-17). **Guards:** `isWebinarCard`, `parseMainPage(raw): WebinarMainPageData` and `parseDetail(raw): WebinarDetail \| null`. They're hand-written, like `isSessionResponse` and `isUserDetails`: every contract key, literal unions for `type` / `login_type` / `registration_status`, and extra keys allowed. |
| `utils/webinar-error.ts` (+ spec)        | Add `WebinarErrorCode`, a union of the documented codes (`invalid_request`, `authentication_required`, `authentication_failed`, `webinar_not_found`, `attempt_not_found`, `missing_email`, `invalid_email`, `missing_first_name`, `invalid_first_name`, `registration_in_progress`, `unsupported_webinar_type`, `webinar_cancelled`, `webinar_inactive`, `webinar_start_time_missing`, `already_registered`) plus `(string & {})`, because codes are additive. Apply it to `WebinarError.code`, `WebinarRegistrationInfo.error_code` and `AttemptStatusResponse.error_code`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `utils/webinar-status.ts`                | `ctaFor(card: FeedCard, …)`. `eligible` is read after narrowing on `bucket === 'completed'` with an `'eligible' in card` guard. Delete the unused `collapseRegistrationStatus` (nothing calls it) and its spec, or type its argument as `InternalAttemptStatus \| null`. Default: delete it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `services/webinar-facade.ts` (+ spec)    | `feedResource` uses `{ parse: parseMainPage }` and `detailResource` uses `{ parse: parseDetail }`, replacing the `raw as …` casts. Specs: the verbatim Postman bodies parse; a body with `total_cpe_credits: "3"` or a missing bucket lands in `error()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `pages/webinar-detail/webinar-detail.ts` | The merged `webinar` computed is typed `FeedCard \| WebinarDetail`. The `eligible` carry-over from MIL-7 now type-checks without optionals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `models/webinar.model.spec.ts`           | Guard tests: the contract example passes, an extra key passes, a wrong literal fails, a nullable field sent as `null` passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Risks (B)

- **A strict parse on a live feed.** If UAT sends a shape the Postman examples don't show, the list page shows its error banner instead of a partly broken page. That's intended, and the guard's error names the resource. The guards allow extra keys and fail only on missing or retyped contract keys. Verify against a live UAT response before merging, if UAT is up.
- **`FeedCard` touches every card consumer.** The compiler lists them all. There's no behaviour change beyond the parse.

---

## Security requirements (both)

- No new routes, no `app-api/`, no change to auth or registration flows.
- Polling stays limited to our own origin (`resolveStatusUrl` untouched).

## Assumptions (reviewer: read these first)

1. **`ServerClock` stays as a ticker.** Only the offset is removed. The one-interval-for-thirty-countdowns reason still holds.
2. **The Sponsor ID row stays** in the NASBA block. It's a constant from our own config, not from the API, and it renders today.
3. **`description` on the About block:** a feed card has no `description`, so the About block shows `short_description` until the detail row lands. That's the current behaviour, now enforced by the types.
4. **`collapseRegistrationStatus` is deleted** (PR B). Nothing calls it, and the contract branches on `registration_status`, not the internal status.

## Checks to run (each PR)

```bash
pnpm lint
pnpm format:fix
pnpm ng test --watch=false
pnpm build:prod
```

State the environment the checks ran in. For PR A, also confirm `grep -rn "badge_icon_url\|program_level\|server_time\|join_opens_at" src/app/features/offerings/webinar` finds nothing.

## How to verify manually (each PR)

`pnpm start` → http://localhost:4101/us/accounting/webinar?preview=design. If UAT is up, check without `?preview` as well.

1. The list page looks the same as before at 375, 768 and 1440 px: rails, CPE pills, CTAs.
2. On a detail page, the About block shows the CPE line, fields of study and Sponsor ID, with no empty headings.
3. PR B only: with a DevTools Override on `webinar-main-page/` that returns a malformed body, the list shows its error banner.

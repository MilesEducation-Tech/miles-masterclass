# Webinar fixes: CPE rename, detail-page CTA and not-found handling

**Branch:** `fix/MIL-XXX-webinar-contract-fixes`, cut from `origin/master` after the profile PR (MIL-6) is committed.
**Commit:** `fix(offerings): read total_cpe_credits and correct the webinar detail CTA`
**Size target:** about 200 changed lines, specs included.

## Jira ticket

Paste this into Jira, then rename the branch to the issued `MIL-<n>`. Template: `docs/engineering/jira-ticket-template.md`.

> **Summary:** `fix(offerings): read total_cpe_credits and correct the webinar detail CTA`
> **Issue type:** Bug · **Component / scope:** offerings (webinar) · **Branch:** `fix/MIL-<n>-webinar-contract-fixes`
> **Links:** Postman `06. Events and Bookings` → `WEB GET events-webinar-main-page-v1`, `WEB GET events-webinar-details-page-v1`, `UNIVERSAL POST register-via-zoom` · `prompts/webinar-fixes.md` · relates to MIL-5, MIL-6
>
> **Context:** The new Postman contract matches our webinar paths, registration handshake, polling and error codes. Four behaviour bugs remain, one of them caused by a field rename.
>
> **Current behaviour:**
>
> 1. The CPE badge and the "X CPE" line never show. The backend renamed `cpe_credits` to `total_cpe_credits` on 2026-09-18 with no alias.
> 2. On the detail page, the button still says "Register Now" after a successful registration. Only the feed reloads, and the detail row takes priority over it.
> 3. A past webinar opened from a direct link shows "Register Now". An attended one never shows "CPE earned". The detail banner always acts as if the webinar is in the highlight bucket.
> 4. An upcoming orientation or premiere is labelled "Ended".
> 5. An old integer-id link (`/webinar/123`) shows "We could not load this webinar" instead of the not-found page. The details route answers 400 for a non-uuid id.
>
> **Expected behaviour:** The CPE amount comes from `total_cpe_credits`. Registering updates the detail page without a reload. A past webinar shows its real past state. A type we can't register shows "Registration not open here". A non-uuid id shows the not-found page.
>
> **Scope:**
>
> - In: the 5 items above.
> - Out:
>   - Typing tightened per bucket, the dead NASBA/badge/`join_opens_at`/`server_time` UI, and `(string & {})` error-code unions. These go in the webinar typing ticket.
>   - Legacy `webinar/filter`, feedback and badge routes (waiting on the backend).
>
> **Acceptance criteria:**
>
> - [ ] Cards and the About block show `total_cpe_credits` (e.g. "3.5 CPE"). `null` or 0 hides it.
> - [ ] After registering on `/webinar/<id>`, the CTA moves to Registered or Join without a page reload.
> - [ ] `/webinar/<past-id>` shows Ended, CPE earned, Not eligible, Missed this one or Not registered, whichever matches its bucket. It never shows Register.
> - [ ] An upcoming `orientation` or `premier` shows "Registration not open here", not "Ended".
> - [ ] `/webinar/123` shows the not-found state.
> - [ ] `pnpm lint`, `pnpm ng test --watch=false` and `pnpm build:prod` pass (state the environment).
>
> **How to verify:** Locally (`pnpm start`, port 4101) against UAT: the list page, a detail page, register, a past webinar via its URL, and `/webinar/123`. `?preview=` feeds cover the states if UAT is down.
>
> **Estimate:** M

## What I read

- **Postman.** Folder `06`: the root and folder `definition.yaml`, the web main-page and details-page requests with their examples, and register-via-zoom with its status route. The card contract (§8) is: `total_cpe_credits: float | null`; `eligible` only on `completed_webinar`; the details page returns the same card plus `description`, `trailer_*` and `product`, and never `eligible`; `type` is `webinar | offline | orientation | premier`, and only the first two can be registered here.
- **Code** (`features/offerings/webinar/`):
  - `models/webinar.model.ts`
  - `utils/webinar-status.ts` (+ spec)
  - `utils/webinar-preview.ts`
  - `services/webinar-facade.ts` (+ spec)
  - `pages/webinar-detail/webinar-detail.ts|html`
  - `components/webinar-hero/webinar-hero.ts`
  - `components/webinar-card/webinar-card.html`
  - `components/webinar-about/webinar-about.ts|html`
  - `components/join-cta/join-cta.html`

## Fixes

| #   | Problem                                                                                                             | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Files                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| W1  | The card type and 3 readers use `cpe_credits`, which the API no longer sends.                                       | Rename the field to `total_cpe_credits: number \| null` on `WebinarCard`, and update `webinar-card.html:214`, `webinar-about.html:64`, `webinar-about.ts:58` (`hasCpe`), the preview fixture and the status spec fixture. No alias: the contract has none, and an alias would hide the next rename.                                                                                                                                                                                                                                                                                                                                     | model, card, about, `webinar-preview.ts`, `webinar-status.spec.ts`              |
| W2  | `register()` → `reload()` reloads only `feedResource`. The detail page prefers `detailResource`, which stays stale. | `reload()` reloads both. `detailResource.reload()` does nothing when `detailId` is null, so the landing page is unaffected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | facade (+ spec: after a successful register, the details request is sent again) |
| W3  | The detail hero hard-codes `bucket: 'highlight'`. The details payload has no bucket and no `eligible`.              | (a) Add a facade method `bucketOf(id): WebinarBucket \| null`, which looks the id up in the five feed buckets the same way `findById` does. (b) `WebinarHero` gets `bucket = input<WebinarBucket>('highlight')`; the detail page passes `facade.bucketOf(id()) ?? 'highlight'`. (c) The detail page's `webinar` keeps the detail row but carries `eligible` over from the feed row when there is one (the details payload never has it). (d) Safety net for a cold deep link to a past webinar that isn't in any bucket: in `ctaFor`, an **unregistered** card whose `effectiveEndAt` has passed returns `'ended'`, never `'register'`. | facade, hero, detail page, `webinar-status.ts` (+ specs)                        |
| W4  | `ctaFor` returns `'ended'` for any card that isn't registrable.                                                     | Add a CTA state `'not-registrable'` with the label **"Registration not open here"**. It isn't actionable, so `join-cta` shows it as a chip, like `ended`. The past check from W3(d) runs first, so a past orientation still reads "Ended".                                                                                                                                                                                                                                                                                                                                                                                              | `webinar-status.ts` (+ spec), `CTA_LABELS`                                      |
| W5  | A details 400 `invalid_request` (non-uuid `webinar_id`) is logged as an error and shows the generic error state.    | Treat a details **400** like a 404: the page shows the not-found state and nothing is logged as an error. Rename `isDetail404` to `isDetailNotFound`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | facade (+ spec)                                                                 |

## Security requirements

- Nothing changes about auth. Register still prompts a signed-out visitor to sign in first, and polling is still limited to our own origin.
- No new HTTP routes or `app-api/` paths (the ESLint rule enforces this).

## Assumptions (reviewer: read these first)

1. **"Registration not open here" wording (W4).** The contract only says orientations and premieres "have their own flows" and doesn't name them. The chip is honest and has no action. When the backend names those flows, this state gets a button.
2. **Carrying `eligible` over (W3c).** The details payload never has `eligible`. Trusting the feed row is safe because both come from the same attendance data. With no feed row (a cold deep link), a completed webinar can't be told apart, so it falls to W3(d) and shows "Ended".
3. **400 counts as not-found (W5).** The only documented details 400 is a malformed `webinar_id`, which to the learner means "no such webinar". Any other 400 would be our bug, and a spec pins the id case.
4. **Visual changes.** The CPE pill reappears on cards and in the About block, and orientations get the new chip. Visual parity is checked at 375, 768 and 1440 px.

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm ng test --watch=false
pnpm build:prod
```

Record the environment the checks ran in.

## How to verify manually

`pnpm start` → http://localhost:4101/us/cpa/webinar. If UAT is down (it answered 503 on 2026-09-27), use the `?preview=` feeds and state that.

1. The list page shows CPE pills on the cards.
2. Open an upcoming webinar and register. The CTA changes without a reload.
3. Open a completed webinar from its rail and see "CPE earned" or "Not eligible". Paste its URL into a new tab and it still shows a past state, never "Register Now".
4. Open `/us/cpa/webinar/123` and see the not-found state.
5. Check 375, 768 and 1440 px.

## Risks

- **`bucketOf` depends on the feed.** On a deep link it resolves once the feed lands. Until then the hero shows the W3(d) fallback (Ended or Register, by date), so the CTA can change once. It's a real state change, not a flicker between wrong states.
- **The new CTA state.** Every exhaustive `Record<WebinarCta, …>` (`CTA_LABELS`, anything in `join-cta`) must gain the key. The compiler enforces that.

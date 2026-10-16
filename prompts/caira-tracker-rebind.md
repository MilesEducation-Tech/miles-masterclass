# CAIRA tracker — rebind to `web-api/v1/badges/page/`

## Goal

Make the CAIRA tracker work again. Every one of its reads is dead, and one new endpoint
replaces all four.

## What this read

`features/tracker/caira/**` (all 15 files), `core/models/caira-badge.model.ts`,
`core/utils/parse-next-page.ts`, `core/utils/with-previous-value.ts`,
`core/guards/auth/auth-guard.ts`, `features/features.routes.ts`, `app.routes.server.ts`,
and the established web-API binding pattern in `features/offerings/services/course-detail-facade.ts`,
`features/offerings/models/course-detail.model.ts`, `features/offerings/utils/contract-guards.ts`,
`core/services/masterclass-home-facade/masterclass-home-facade.ts`,
`features/library/course/services/course-facade.ts` (the paging accumulator).

## Live probe (UAT, 2026-10-13)

| Endpoint                         | Status                          |
| -------------------------------- | ------------------------------- |
| `v2/caira-badges/`               | **404**                         |
| `v2/course-badges/`              | **404**                         |
| `v2/webinar-badges/`             | **404**                         |
| `user-badges/:id/claim/`         | **404**                         |
| `web-api/v1/badges/page/`        | 401 (exists, `IsAuthenticated`) |
| `web-api/v1/masterclass/levels/` | 200 anonymously                 |

The feature is broken end to end, not merely unbound. `BadgeRow` and `CairaLevelHero` treat a
failed fetch as "no data" and hide themselves, so today the page renders an empty shell.

## Locked decisions

1. Migrate the **whole feature** — home, both "View all" pages, the ⓘ dialog.
2. Signed out → **redirect to login** (`authGuard` on the route).
3. **Drop** the Podcast and Nano-Learning rows; the endpoint has no section for them.
4. **Infinite scroll** stays — the existing `IntersectionObserver` + accumulator is reused.
5. Introduce a **facade**. One endpoint feeding four surfaces is what AGENTS.md §3 asks for,
   and it collapses five requests into one.

## Assumptions

- **A1.** The ⓘ dialog is removed. Its tabs came from `v2/caira-badges/:id/`'s `badge.content`;
  that route is 404 and `badges/page/` has no `description` or `content`.
- **A2.** Claiming is backend-blocked. `badge_claim` carries no id, so there is nothing to POST
  to. The client opens `badge_claim.accept_url` when the server populates it.
- **A3.** `state`, `cta.action` and `badge_claim.state` are **half-observed** — the only sample
  is a zero-progress user (everything `LOCKED` / `COMING_SOON` / `NOT_ISSUED`). Guards check
  `isStr`, never union membership, so an unobserved `EARNED` cannot fail the whole response.
  Anything derived for the UI keys off fields whose meaning is stable — `badge_claim.awarded`,
  `badge_claim.claimed`, `cta.enabled` — not off the enum.
- **A4.** Level artwork is `badge_image_url` (the Credly image on the row), not a second call
  to `masterclass/levels/` for its `image_url`.

## Endpoint

`GET web-api/v1/badges/page/` → `{success, message, data}` with `cpe_summary`, `level_badges`,
`webinar_badges`, `masterclass_badges`, `counts`.

Each section is `{slug, count, page, page_size, total_pages, has_next, has_previous, next,
previous, results}`. Paging parameters are **namespaced**: `?webinar_badges.page=2&webinar_badges.page_size=6`.

## Files

| File                                                 | Change                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `models/caira-badge-page.model.ts`                   | NEW — wire types, guards, `parse`, endpoint const, UI derivations           |
| `services/caira-badges-facade.ts`                    | NEW — the one read, per-section paging, exposed signals                     |
| `services/badge-actions.ts`                          | REWRITE around the server-sent `cta`                                        |
| `utils/badge-action.ts`                              | DELETE — the server computes the action now                                 |
| `caira-tracker.routes.ts`                            | `canMatch: [authGuard]`, `providers: [CairaBadgesFacade, BadgeActions]`     |
| `components/caira-level-hero/*`                      | inject the facade; drop its resource and the ⓘ button                       |
| `components/badge-row/*`                             | inject the facade; drop its resource; `section` input replaces `courseType` |
| `components/course-badge-card/*`                     | new fields                                                                  |
| `components/webinar-badge-card/*`                    | new fields                                                                  |
| `pages/caira-tracker/*`                              | two rows, not four                                                          |
| `pages/course-badges/*`, `pages/webinar-badges/*`    | read the facade; keep the sentinel                                          |
| `dialogs/caira-badge-info-dialog/`                   | DELETE (A1)                                                                 |
| `utils/level-progress.ts`, `utils/level-carousel.ts` | retype onto the new level badge                                             |
| `core/models/caira-badge.model.ts`                   | DELETE; keep `UserBadgeStatus`, still used by the CPE side                  |

## Security

Nothing new reaches the browser. The read is `IsAuthenticated` and the token is attached by
`appInterceptor` — never by hand. `authGuard` gates the route; the facade's request function
gates on the **boolean** `isAuthenticated()`, never the token string, so a rotation does not
refire the read.

## Acceptance

- One request to `badges/page/` per page load, not five.
- Signed out, `/us/cpa/caira-tracker` redirects to `/auth/login?redirect=…`.
- Home shows the level hero + exactly two rows.
- `webinar-badges` scrolls from 6 to 10 and stops; `course-badges` shows 6 and stops.
- A page already loaded is never appended twice when the other section pages.

## Checks

`pnpm lint`, `pnpm format:fix`, `pnpm build:prod`, then the browser on 4101.

## Risks

- The `state` / `action` / claim enums are half-observed (A3). The filter chips are the weakest
  surface and cannot be validated without a learner who has earned a badge.
- `next_session` is `{}` on every webinar row, so the webinar card loses its date line.
- The claim path (A2) cannot be exercised at all until the backend answers.

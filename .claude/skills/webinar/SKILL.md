---
name: webinar
description: The Webinar feature of Miles Masterclass v3 — live and recorded webinars, registration and enrolment, WebinarFacade CTA state machine, and the legacy premiere → webinar redirects. Read before touching features/offerings/webinar.
---

# Webinar

Live and recorded webinar sessions. Unlike the other offerings this is **time-based**: what a learner can do depends on where "now" sits relative to the session, so the CTA is a state machine rather than a fixed button.

## Files

```
features/offerings/webinar/
├── webinar.ts                                        # routes + list page
└── shared/
    ├── services/webinar-facade/                      # 410 lines
    ├── models/webinar-registration.model.ts
    ├── utils/webinar-status.ts                       # time → status
    ├── utils/upcoming-to-content.ts                  # UpcomingPremiere → ContentDetails
    ├── fixtures/featured-webinars.fixture.ts
    ├── pages/webinar-course/
    └── components/{webinar-hero,webinar-claim-card,premiere-list-item,webinar-registration-form}/
```

Dialogs live in `shared/components/dialog/`: `webinar-details-dialog`, `webinar-registration-dialog`, `calendly-dialog`.

## Routes

```
/:country/:profession_type/webinar                     list — RenderMode.Client
  /:courseId/:courseTitle                              detail
    /feedback
```

No chapters and no final assessment — a webinar is a single session. The list is `RenderMode.Client` because its content is entirely time-relative.

`WebinarFacade` is also provided on the UAE CAIRA `home` route, which renders the live-webinar registration block.

## WebinarFacade

**State**: `featuredWebinars`, `bookings`, `attended`, `missed`, `loading`, `error: WebinarLoadError`.

**Computed**: `liveOrNextUp` (the one thing to surface right now), `upcomingList`.

**Actions**: `loadHomePage`, `ctaFor(webinar)`, `enroll`, `openDetails`, `openRegistration`, `registerAndEnroll`, `submitFeedback`, `openCertificateDownloadDialog`.

## The CTA state machine

`ctaFor(webinar)` returns a `WebinarCta`. **Never branch on webinar status inline in a template** — every surface that shows a webinar must go through `ctaFor` or the four lists disagree with each other.

Status comes from `utils/webinar-status.ts`, which compares session time against now. Everything downstream is derived from that one function; a second time comparison anywhere else is a bug in waiting.

Time handling: sessions are timezone-sensitive. Use the `local-time-zone` pipe (`shared/core/pipes/local-time-zone/`) for display and keep comparisons on the raw timestamps. Never compare formatted strings.

## Registration

`webinar-registration-form` → `webinar-registration-dialog` → `registerAndEnroll`. Anonymous visitors can register; the form captures the details an account would otherwise supply. Validate at the boundary — this is a public write path.

`calendly-dialog` handles the scheduling variant.

## `upcoming-to-content.ts`

Adapts `UpcomingPremiere` into the `ContentDetails` shape so webinars can render in shared card and hero components. When you add a field to `UpcomingPremiere`, decide whether the adapter should carry it — a missing mapping shows up as a blank field on shared components only.

## Legacy `premiere` redirects

Webinars used to live at `/premiere`. Redirects are declared in `features.ts` **before** the lazy children, using the **functional** `redirectTo` form:

```ts
{ path: 'premiere/:courseId/:courseTitle', pathMatch: 'full',
  redirectTo: r => `webinar/${r.params['courseId']}/${r.params['courseTitle']}` }
```

Angular's static `redirectTo: 'webinar/:courseId/...'` does **not** substitute params reliably — it sends users to a literal `/:courseId`. Keep the functional form. Id-only links get a `webinar` placeholder title, matching server-side behaviour. Production SSR redirects are handled separately in `src/legacy-redirects.ts`.

## Gotchas

- `featured-webinars.fixture.ts` is a fixture. Confirm whether a surface is meant to use it or the API before wiring.
- `error: WebinarLoadError` is a typed union, not a string — render the right message per case.
- Feedback exists; a final assessment does not. Don't wire the assessment flow here.
- All four lists (`featured`, `bookings`, `attended`, `missed`) come from one `loadHomePage()` call. Don't add a per-list fetch.

## Verify

```bash
pnpm start
```

1. `/us/cpa/webinar` — featured, upcoming, bookings, attended, missed all render.
2. `liveOrNextUp` surfaces the right session; check a live one, a future one and a past one.
3. Register for an upcoming session — dialog validates, enrolment moves it into bookings.
4. Attended session → certificate download.
5. `/us/cpa/premiere/123/some-title` → redirects to the real `/webinar/123/some-title`, **not** a literal `:courseId`.
6. Switch your machine's timezone and confirm times still read correctly.

# CAIRA gap register

Frontend surfaces with no counterpart in the CAIRA Web API (50 endpoints,
`CAIRA_Web_API_Reference.md`). Each entry names what the UI needs, what the backend would have to
add, and what the code does in the meantime.

Nothing here is broken-on-purpose: every listed surface either renders an empty state or hides the
affected control. None points at a dead URL.

Last updated: end of P2.

## Blocking implementation

| #    | Gap                                                     | Blocks                 | Notes                                                                                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-01 | `CAIRAMasterclassQuizQuestionSerializer` field list     | P5 quiz (#7, #9)       | Explicitly outside the reference's scope. Needs a UAT capture before the quiz can be typed.                                                                                                                                                                                         |
| G-02 | `CAIRAMasterclassFeedbackQuestionSerializer` field list | P5 feedback (#12)      | Same.                                                                                                                                                                                                                                                                               |
| G-03 | `_build_full_course_progress` key set                   | P4 progress (#17, #18) | Same. Also `get_items()`'s single-vs-bulk wrapper key in `Masterclass/schemas.py`.                                                                                                                                                                                                  |
| G-04 | QR crypto contract                                      | P8                     | `account/qr_login/crypto.py` is out of scope: curve, KDF, AES mode and `public_key` encoding are all unspecified, so the browser cannot decrypt the `{epk, iv, ct}` blob. Also unknown: `store.SESSION_TTL`, `make_pin()` format, whether the dash in `"4324-3456"` is significant. |

## Auth and profile

| #    | Gap                                                                                             | Where it shows                                                                       | Current behaviour                                                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| G-05 | **No OTP throttling.** #34 and #35 are both unthrottled server-side; only #33 has a rate limit. | Login                                                                                | A 30 s client-side resend cooldown, which stops double-taps but not abuse. Backend ask.                                                         |
| G-06 | No email-OTP login route.                                                                       | Login, Email tab                                                                     | The Email tab is email **+ password** (#33). `otp/generate` / `otp/validate` exist but verify an address post-login; they are not a login path. |
| G-07 | No password reset.                                                                              | `/auth/forget-password`                                                              | Route exists, component is an empty stub. #33 has no reset endpoint and the phone path has no password.                                         |
| G-08 | No signup.                                                                                      | `/auth/signup`                                                                       | Route exists, component is an empty stub. Accounts are created in the Miles One app.                                                            |
| G-09 | `onboarding` is unusable as a completeness signal — #33 hardcodes it `true`.                    | `isExistingUserGuard`                                                                | Completeness derives from `v2/status`'s `mo_first_name` / `mo_full_name` / `mo_email` instead.                                                  |
| G-10 | Profile reference data: **state boards, professional courses, companies, sectors, job roles**.  | `/auth/profile` (5 of 13 fields), profile-completion dialog, firm-sponsorship dialog | Fields render with empty option lists and are excluded from the `v2/update` body. Five reference-data endpoints needed.                         |
| G-11 | Place/location autocomplete.                                                                    | `/auth/profile`                                                                      | The location field is free text.                                                                                                                |
| G-12 | No `is_beta_access` / trial flag on the user.                                                   | Footer `hasTrailAccess`                                                              | Held `false`.                                                                                                                                   |
| G-13 | `#35`'s documented response omits `refresh_token` while `#33`'s includes it.                    | Token lifecycle                                                                      | Read defensively; an absent refresh token means the session ends when the access token expires. Needs confirming against a live OTP login.      |

## Entitlement and commerce

| #    | Gap                                                                                                                            | Where it shows                                                   | Current behaviour                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| G-14 | **No plan or subscription model at all.** Access is `User.enrolled` tag membership, surfaced per-course as `course_is_locked`. | `activePlanGuard`, `Auth.currentPlan`, header, engagement dialog | `currentPlan` stays `null`. Replacing it with an entitlement check is its own decision.  |
| G-15 | Subscriptions, cart, coupons, plans, orders, invoices.                                                                         | `features/payment/**`                                            | Placeholders, empty states. Not a rebind — `commerce/` models one-time product purchase. |
| G-16 | Partner Platform: networks, firms, sub-companies, partner RBAC, coupon tracker.                                                | `admin/partner-platform/**`                                      | Placeholders. Zero backend counterpart.                                                  |
| G-17 | Partner-code redemption, firm sponsorship.                                                                                     | `PartnerCode`, firm-sponsorship dialog                           | Stubbed.                                                                                 |

## Content and discovery

| #    | Gap                                                                | Where it shows                    | Current behaviour                                                                                        |
| ---- | ------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| G-18 | Micro-learning as a CPE course type.                               | `offerings/micro-learning/**`     | No chapters, quiz, assessment or per-course CPE in CAIRA. Empty state.                                   |
| G-19 | Podcast as a CPE course type.                                      | `offerings/podcast/**`            | Same.                                                                                                    |
| G-20 | Text search and suggestions.                                       | Global search                     | No search endpoint anywhere in the backend. Service deleted.                                             |
| G-21 | Instructor **list** (detail-only exists at #16).                   | `library/instructor-library`      | Empty state.                                                                                             |
| G-22 | Recommendations, because-you-watched, complimentary.               | 4 of the 8 masterclass home feeds | Empty rails.                                                                                             |
| G-23 | Webinar **registration**. #20/#21 expose `registration` read-only. | `webinar-registration-form`       | No binding target.                                                                                       |
| G-24 | Public (crawlable) course detail — #4 requires a JWT.              | SEO on course pages               | Anonymous crawlers get the shell plus the Supabase `seo_pages` row. A public variant of #4 would fix it. |

## Reporting

| #    | Gap                                                                                               | Where it shows                      | Current behaviour                                                                          |
| ---- | ------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| G-25 | **CPE credits by calendar year.** CAIRA aggregates by level; there is no year dimension anywhere. | CPE tracker toolbar year selector   | Compliance reporting is year-based, so this is a real functional gap, not cosmetic.        |
| G-26 | Bulk certificate download.                                                                        | CPE tracker toolbar                 | Certificates are per-context embedded URLs; there is no download endpoint.                 |
| G-27 | NASBA CSV template.                                                                               | CPE tracker toolbar                 | No endpoint.                                                                               |
| G-28 | Country / profession scoping of content, pricing and copy.                                        | `/:country/:profession_type` prefix | No CAIRA endpoint takes either parameter. The prefix is now cosmetic and is not forwarded. |

## Backend defects worth raising

Found while binding; none is a frontend bug, and all are coded around.

| Where                   | Issue                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `USP/authentication.py` | No `authenticate_header()` override, so every auth failure returns **403** instead of 401. Verified live.                                                        |
| #39                     | `communication_method=5` returns the generated OTP to **any anonymous caller, for any phone number, with no throttle**. Web binds #34 instead, which refuses it. |
| #23                     | `caira_badges.progress` numerator is the global grand total, so all three levels show the same numerator. #22 is correct.                                        |
| #25                     | A non-UUID `level` 500s with a raw exception instead of returning 400.                                                                                           |
| #20, #24                | Internal failures are flattened to **400**, not 500.                                                                                                             |
| #26 vs #27              | Cache-prefix mismatch (`_V2_` vs non-`_V2_`) — claiming an alumni badge may not invalidate the read for 300 s.                                                   |
| #29                     | Cache read is gated on `not has_token`, which `IsAuthenticated` makes unreachable — written every request, never served.                                         |
| #43                     | The 404 and "Invalid question ID(s)" 400 return from **inside** `transaction.atomic()`, so the transaction still commits.                                        |
| views 1–18              | 500 handlers return `str(exc)` verbatim to the client. The frontend logs it and shows generic copy instead.                                                      |

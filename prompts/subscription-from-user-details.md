# Decide "has a subscription" from `current_subscription_details` in one place

**MIL-173**, branch `feat/MIL-173-subscription-from-user-details` off `master` (`bba0e91c`).
**Status:** approved and implemented 2026-11-04; CPE Tracker settled by the user the same day (decision 9).

## Goal

`GET user-details/` now carries the learner's subscription (contract §3.2). Expose one read-only signal from core,
`AccountApi.hasSubscription`, derived from `current_subscription_details`, and make every subscription decision in
the app read it. Today each of those decisions is a stub (always yes or always no) or reads `CurrentPlanData`, the
shape of a `current-plan/` response that no longer exists.

## What was read

- **Contract** (Postman, account `user-details/` §3.2, added 2026-10-29): three keys on every response, including the
  degraded fallback. `subscription_status` (`Active` / `Deactivate` / `Expired` / `ReSubscribe` / `null`),
  `current_subscription_details` (the term in force, or `null`: `subscription_id`, `product_id`, `plan_id`,
  `plan_name`, `status`, `started_at`, `expires_at`, `days_remaining`) and `queued`. The label is computed from dates;
  the block "does not lag a payment" (its own cache, evicted on every subscription write). **"It is a description,
  not an access gate. Content access is decided server-side; a client must not unlock anything on this label."**
- `core/models/account.model.ts` (`UserDetails`, `isUserDetails`, `parseUserDetails`),
  `core/services/account-api/account-api.ts` (the `user` resource; it already pushes the milestones into
  `AuthSession`, which cannot inject it back), `core/services/auth-session/auth-session.ts`.
- Every subscription decision (grep for `hasActivePlan`, `currentPlan`, `CurrentPlanData`, `subscription_status`,
  `canAccessCpeMode`, `requireCpeModeAccess` and the `ponytail` notes that name the removed session service):

  | Where                                                                                                                                                                                                 | Today                                                                      |
  | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
  | `layout/header/header.ts` `hasActivePlan` (crown on the first item, premium accent, `requires: 'activePlan'` filter)                                                                                  | `signal(false)`                                                            |
  | `layout/footer-overlay/footer-overlay.ts` `subscribed` (the "Subscribe" bar)                                                                                                                          | `signal(false)`: everyone sees it                                          |
  | `shared/services/utils.ts` `canAccessCpeMode` → `requireCpeModeAccess`, `course-chapter-list` `locked`, `micro-learning-reel-card` `gated`, podcast / micro-learning / legacy masterclass CPE actions | always `true`                                                              |
  | `utils.ts` `requireCpeModeAccess` for a signed-out visitor                                                                                                                                            | the sign-in redirect went with the auth layer                              |
  | `tracker/cpe/services/certificate-download.ts` "download all" → `CertificateAccessPolicy.decideBulk(null)`                                                                                            | always refused, subscribers included                                       |
  | `library/badge/pages/badge/badge.ts` claim                                                                                                                                                            | ungated (originally: "Subscription required" toast)                        |
  | `faculty/pages/faculty/faculty.ts` `locked` ("You already have an active subscription…")                                                                                                              | `signal(false)`                                                            |
  | `payment/pages/invoice/invoice.ts`                                                                                                                                                                    | nothing refreshes the flag on a paid order                                 |
  | `shared/services/engagement-dialog.ts` `hasActiveSubscription(CurrentPlanData)`                                                                                                                       | dead: `resolveNext()` returns `null`, the whole loop is off                |
  | `core/models/payment.model.ts` `CurrentPlanData`                                                                                                                                                      | its own comment: "it goes when a subscription-status endpoint exists (Q3)" |

- Checkout leaves with `location.assign` (`PaymentFacade`) and returns as a full page load, so `user-details/` is
  read fresh on the way back.
- `features/offerings` course page (`CourseDetailFacade`) gates on the server's `course_is_locked` and stays as it
  is. `Utils.openCertificateDownloadDialog` gates on the server's per-course `active_plan` and stays as it is.

## Locked decisions

1. **The signal lives on `AccountApi`, not `AuthSession`.** `AccountApi` owns the `user-details/` read and already
   injects `AuthSession`; `AuthSession` injecting `AccountApi` would be circular, and a value pushed into
   `AuthSession` by an effect would only update on pages that happen to instantiate `AccountApi`. It is still one
   core singleton every consumer injects (`inject(AccountApi).hasSubscription`).
2. **`hasSubscription` is three-valued, `boolean | null`:**

   | Value   | When                                                                                                                       |
   | ------- | -------------------------------------------------------------------------------------------------------------------------- |
   | `true`  | `current_subscription_details` is an object (Active, or Deactivate: a cancelled term keeps access until `expires_at`)      |
   | `false` | signed out, or `user-details/` answered with `current_subscription_details: null` (Expired, ReSubscribe, never subscribed) |
   | `null`  | signed in and not known yet: `user-details/` loading or failed, or an environment that doesn't send the key                |

3. **Unknown never paywalls.** Display decisions act only on a known answer (`=== true` shows the crown and the
   faculty lock, `=== false` shows the "Subscribe" bar and the chapter locks). Action gates refuse only on
   `=== false`: a subscriber who clicks before the read lands, or whose read failed, is never sent to the upsell. The
   server stays the real gate (contract), so letting "unknown" through unlocks nothing.
4. **The model types only what the app reads.** `current_subscription_details?: SubscriptionTerm | null` on
   `UserDetails`, optional like `has_password` so an environment without it doesn't fail the record. The guard
   accepts `undefined`, `null` or a plain object. `subscription_status` and `queued` aren't typed: nothing branches
   on them (`docs/AUTH_API.md` lists them).
5. **Signed-out CPE mode goes to sign-in.** `requireCpeModeAccess` sends a signed-out visitor to
   `/auth/login?redirect=<current url>` (the branch the auth-layer removal dropped), and the subscription upsell is
   for signed-in learners only.
6. **A paid invoice refreshes the flag.** When the invoice shows an order with status `paid`, `AccountApi.user`
   reloads once, covering a webhook that landed after the app's first `user-details/` read.
7. **Dead plan code goes:** `core/models/payment.model.ts` (`CurrentPlanData`), `CertificateAccessPolicy` (its
   `decide()` has no caller; "download all" reads the flag), and the engagement dialog's unused
   `hasActiveSubscription`. The engagement loop itself stays off: rewiring it is its own feature.
8. **Names stay where a rename would only churn:** the header keeps `hasActivePlan` (ten template uses) and the
   footer keeps `subscribed`; both now read `hasSubscription`.
9. **CPE Tracker (user, 2026-11-04): visible in the nav, guarded on the route.** The menu item stays for every
   signed-in learner. The `cpe-tracker` route adds `subscriptionGuard` (`core/guards/subscription-guard.ts`, after
   `authGuard`): a learner whose answer is `false` gets the info toast "Subscription Required — You need an active
   plan to access this content." and lands on `/<country>/<profession>/payment/plan`. While `user-details/` is still
   loading the guard waits for it; a failed read lets the learner in (decision 3). The stale `nav.config.ts` comment
   is corrected. The CAIRA tracker is not touched.

## Target code

```ts
// core/models/account.model.ts
/** The subscription term in force (contract §3.2): the furthest-expiring active term under stacked renewals. */
export interface SubscriptionTerm {
  subscription_id: string;
  product_id: string;
  plan_id: string;
  /** Operator-authored, may be "": a label, never an identifier. */
  plan_name: string;
  status: string;
  started_at: string;
  expires_at: string;
  days_remaining: number;
}
// UserDetails gains: current_subscription_details?: SubscriptionTerm | null;

// core/services/account-api/account-api.ts
readonly hasSubscription = computed<boolean | null>(() => {
  if (!this.auth.isAuthenticated()) return false;
  if (!this.user.hasValue()) return null;
  const term = this.user.value().current_subscription_details;
  return term === undefined ? null : term !== null;
});
```

Consumers:

- header: `hasActivePlan = computed(() => this.account.hasSubscription() === true)`.
- footer overlay: `subscribed = inject(AccountApi).hasSubscription` (its `null` already means "show nothing").
- `Utils.canAccessCpeMode(content)`: `canAccessCpeMode(content, this.account.hasSubscription() !== false)`;
  `requireCpeModeAccess` adds the signed-out branch before the upsell.
- `CertificateDownload.downloadAllCertificates`: refused only when `hasSubscription() === false`.
- badge claim: `hasSubscription() === false` → the original "Subscription required" info toast, no claim call.
- faculty: `locked = computed(() => this.account.hasSubscription() === true)`.
- invoice: an effect reloads `AccountApi.user` once when `order()?.status === 'paid'`.

## Endpoint map

| Route                              | Change                                            |
| ---------------------------------- | ------------------------------------------------- |
| `GET api/v1/account/user-details/` | read one more key, `current_subscription_details` |

No new calls. No `app-api/`.

## Phases

One PR: model + signal → consumers → dead code → docs → checks → browser run. If the diff passes ~400 lines, split
after the first step (model + `hasSubscription` + header/footer) and move the gates in a second PR.

## Files touched (~200 lines of code)

- `src/app/core/models/account.model.ts`: `SubscriptionTerm`, `UserDetails.current_subscription_details`, guard.
- `src/app/core/services/account-api/account-api.ts`: `hasSubscription`.
- `src/app/layout/header/header.ts`, `src/app/layout/footer-overlay/footer-overlay.ts`.
- `src/app/shared/services/utils.ts`.
- `src/app/features/tracker/cpe/services/certificate-download.ts`; delete `certificate-access-policy.ts`.
- `src/app/features/library/badge/pages/badge/badge.ts`.
- `src/app/features/faculty/pages/faculty/faculty.ts`.
- `src/app/features/payment/pages/invoice/invoice.ts`.
- `src/app/core/guards/subscription-guard.ts` (new), `src/app/features/tracker/cpe/cpe-tracker.routes.ts`,
  `src/app/layout/header/nav.config.ts` (comment).
- `src/app/shared/services/engagement-dialog.ts`; delete `src/app/core/models/payment.model.ts`.
- `docs/AUTH_API.md` (the user record section), `docs/refactor/STATE.md`, this prompt.

## Security requirements

- The flag decides what the UI shows, never what the learner may access. Video URLs, certificates and badge claims
  stay gated by the server; nothing is unlocked on `hasSubscription`.
- Nothing about the subscription is cached, stored or put in a URL; it is re-read with `user-details/`.

## Acceptance criteria

1. Subscribed (`current_subscription_details` set, `Active`): crown and premium accent in the header, no
   "Subscribe" bar, CPE mode opens with no upsell and no chapter locks, "download all certificates" works, badge
   claim goes ahead, the faculty form says there's nothing to request, CPE Tracker opens.
2. `Deactivate` with the term still set: same as 1.
3. `Expired` / `ReSubscribe` / never subscribed (`null`): no crown, "Subscribe" bar shows, paid podcast and
   micro-learning chapters show locked, CPE mode opens the subscription upsell, "download all" shows the upgrade
   message, badge claim shows "Subscription required", the faculty form is open, CPE Tracker is still in the
   menu but opening it toasts "Subscription Required" and lands on the plan page.
4. Free content and individually bought content (`is_free` / `active_plan`) still open CPE mode without a
   subscription.
5. Signed out: no `user-details/` call; CPE mode on paid content goes to sign-in and comes back.
6. `user-details/` slow or failing: nothing paywalls, no crown, no "Subscribe" bar, no locks; the answer applies
   as soon as the read lands.
7. Opening a paid invoice reloads `user-details/` once, and the header shows the subscribed state without a refresh.
8. Nothing outside `AccountApi` reads `current_subscription_details`; `CurrentPlanData` is gone.

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm build:prod
```

## How to verify

Dev server 4101, Playwright, English, stubbed `user-details/` (`current_subscription_details` set / `null` / absent /
500 / slow) with the stub session cookies. Per state: header crown, footer bar, a podcast or micro-learning course's
chapter locks and CPE action, CPE Tracker "download all", a badge claim (request recorded, not sent), the faculty
form, and an invoice stub with a `paid` order (count `user-details/` reads). Signed out: CPE action → login URL with
`redirect`. Then one live UAT look with a real account, if one with a subscription is available.

## Risks

- **The paywall turns on.** CPE mode and chapter locks have been open to everyone since the auth layer was removed;
  after this, non-subscribers meet the upsell on podcast and micro-learning paid content. That is the intent, but it
  is a visible change; QA should know.
- **Old-API payloads:** podcast and micro-learning reels read `is_free` / `active_plan` from the older course
  payloads; a reel that is individually bought but lacks `active_plan` (the known `nano_learning` gap in
  `micro-learning-course-facade.ts`) now meets the upsell instead of passing.
- **Contract drift:** if `current_subscription_details` is renamed, `hasSubscription` reads `null` (nothing
  paywalls, nothing shows as premium) rather than failing the user record.

## Out of scope (follow-ups)

- The plan page's "Already subscribed" state (`prompts/commerce-api-rebind.md`, deferred until Q3).
- Re-enabling the engagement popup loop.
- Showing plan name, expiry or `days_remaining` anywhere.

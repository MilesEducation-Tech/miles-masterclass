import { CairaUuid, WebinarId } from '../models/caira/envelope.model';

/**
 * Every CAIRA path this app is allowed to call, in one place.
 *
 * Paths are relative — `ApiClient.resolveUrl` prepends `environment.BASE_API_URL`.
 * CAIRA registers its routes at the Django URLconf **root**, so unlike the old
 * Django API there is no `/api/` prefix in any of these.
 *
 * No `RouteConfig` phantom types. The old `*_ROUTES` registries carried
 * `_requestType`/`_responseType` marker fields purely so a facade could write
 * `RouteResponse<typeof X>`; that was ~500 lines of boilerplate to avoid typing
 * `api.get<TopSectionResponse>(...)` at the call site. The call site is shorter
 * and reads better.
 *
 * **Trailing slashes are load-bearing.** Django's `APPEND_SLASH` will not save a
 * POST — it 301s, and a 301 on a POST drops the body. The web LMS and `caira/`
 * routes end in `/`; the `account` routes mostly do not; `register-device/` and
 * `chatbot/user_details/` do. They are reproduced here exactly as registered.
 */

/** The standalone web client's own prefix. Replicated logic, no shared call paths with mobile. */
const WEB = 'CAIRA_LMS_Masterclass_MilesOne_Web';

/** The web module's nested masterclass namespace. */
const WEB_MC = `${WEB}/caira/masterclass`;

export const CAIRA = {
  // -------------------------------------------------------------------------
  // Catalog — auth-optional, so these stay server-renderable (§1.5)
  // -------------------------------------------------------------------------

  /** #1 · GET · optional auth · `limit` / `page` / `offset` */
  topSection: `${WEB}/Top_Section/`,

  /** #2 · GET · optional auth · `limit` / `page` / `offset` */
  courseSection: `${WEB}/Masterclass_Course_Section/`,

  /** #3 · GET · **auth required** · same envelope as #2 but with no `course_status` */
  completedCourseSection: `${WEB}/Completed_Masterclass_Course_Section/`,

  /** #4 · GET · auth required · server-cached per user over a global base key */
  courseDetail: (courseId: CairaUuid) => `${WEB}/Masterclass_Course_Detail/${courseId}/`,

  // -------------------------------------------------------------------------
  // Course lifecycle
  // -------------------------------------------------------------------------

  /** #5 · GET · levels 1-3, array rotated so the first "Ongoing" level leads */
  levelsProgress: `${WEB}/caira/levels_progress/`,

  /** #6 · POST · **no body** · creates the 365-day enrollment; may return `reset_required` */
  chapterStart: (chapterId: CairaUuid) => `${WEB_MC}/chapter/${chapterId}/start/`,

  /** #7 · GET · resume branch returns a heterogeneous `questions` array */
  quizQuestions: (chapterId: CairaUuid) => `${WEB_MC}/quiz/${chapterId}/questions/`,

  /** #8 · POST · **one question per request**, not a batch */
  quizSubmit: (chapterId: CairaUuid) => `${WEB_MC}/quiz/${chapterId}/submit/`,

  /** #9 · GET · carries `pass_threshold_percent` — the real gate, unlike #10's copy */
  assessmentQuestions: (courseId: CairaUuid) => `${WEB_MC}/${courseId}/assessment/questions/`,

  /** #10 · POST · `answers.length` must equal #9's `questions_to_show` or 400 */
  assessmentSubmit: (courseId: CairaUuid) => `${WEB_MC}/${courseId}/assessment/submit/`,

  /** #11 · GET · latest active attempt; the only response using `question_text` + `was_selected` */
  assessmentResult: (courseId: CairaUuid) => `${WEB_MC}/${courseId}/assessment/result/`,

  /** #12 · GET · course-specific questions plus the global (`Masterclass_Course IS NULL`) set */
  feedbackQuestions: (courseId: CairaUuid) => `${WEB_MC}/${courseId}/feedback/questions/`,

  /** #13 · POST · triggers the whole credential pipeline (CPE, badge, certificate) */
  feedbackSubmit: (courseId: CairaUuid) => `${WEB_MC}/${courseId}/feedback/submit/`,

  /** #14 · GET · read-only enrollment window */
  enrollment: (courseId: CairaUuid) => `${WEB_MC}/${courseId}/enrollment/`,

  /** #15 · POST · **pure toggle, no body** — any body sent is ignored server-side */
  bookmark: (courseId: CairaUuid) => `${WEB_MC}/${courseId}/bookmark/`,

  /** #16 · GET · **un-enveloped** — the serializer's `.data` dict is the whole body */
  instructorDetail: (instructorId: CairaUuid) => `${WEB_MC}/instructor/${instructorId}/`,

  /** #17 · GET · a different payload from #4 — do not substitute one for the other */
  courseProgress: (courseId: CairaUuid) => `${WEB_MC}/course-progress/${courseId}/`,

  /** #18 · POST · single chapter or bulk list; `skipped` is omitted when empty */
  courseProgressUpdate: (courseId: CairaUuid) => `${WEB_MC}/course-progress/${courseId}/update/`,

  // -------------------------------------------------------------------------
  // Badges — note #19 and #28 share a name but take different payloads
  // -------------------------------------------------------------------------

  /** #19 · POST · `{ credly_assertion_id }` · the web twin. Prefer this over #28. */
  levelBadgeClicked: `${WEB}/caira/level_based_badge_clicked/`,

  /** #28 · POST · `{ credly_accept_url }` · the `caira/` twin, CAIRA level badges only */
  levelBadgeClickedByUrl: 'caira/level_based_badge_clicked/',

  /** #22 · GET · web-only, but routed under `caira/`. Per-level totals are correct here. */
  badgesTrackerWeb: 'caira/get_badges_tracker_web/',

  /**
   * #23 · GET · shared with mobile.
   * Its `caira_badges.progress` numerator is the **global** grand total, so all
   * three levels show the same numerator. Prefer #22 on web.
   */
  allBadgesV4: 'caira/get_all_badges_V4/',

  /** #24 · GET · `?section=level|webinar|masterclass` · `?limit=` · catch-all returns 400 not 500 */
  badgesCatalog: 'caira/badges_catalog/',

  /** #25 · GET · `?level=<uuid>` **required**; a non-UUID 500s with a raw exception */
  cpeProgress: 'caira/cpe-progress/',

  /** #26 · GET · 0-2 items, CPA then CMA · cached 300 s per user */
  alumniBadges: 'caira/get_alumni_badges/',

  /** #27 · POST · `{ badge_id }` · cache-prefix mismatch means #26 can stay stale 300 s */
  claimAlumniBadge: 'caira/claim_alumni_badge/',

  /** #29 · GET · POST · GET's `data.id` is polymorphic — branch on `showfeedback` first */
  feedbackOrBadgeStatus: 'caira/feedback_or_badge_status_v2/',

  /** #30 · GET · always exactly 4 items: cpa, cma, usp, caira */
  otherBadgeStatus: 'caira/other_badge_status/',

  // -------------------------------------------------------------------------
  // Webinars — the only integer ids in the API
  // -------------------------------------------------------------------------

  /** #20 · GET · all active webinars grouped `{upcoming, expired, completed}`; no pagination */
  allWebinarsWeb: `${WEB}/caira/all_webinars_web/`,

  /** #21 · GET · `id` is the **integer** `Webinar.webinar_id`, not a UUID */
  webinarDetail: (id: WebinarId) => `${WEB}/caira/webinars_web/${id}/`,

  /** #31 · GET · `?webinar_id=<pk>` · returns a **bare JSON array**, DRF `{detail}` errors */
  webinarFeedbackQuestions: 'caira/webinar_feedback_questions/',

  /** #32 · POST · `?webinar_id=<pk>` stays a **query param even on the POST** · returns 201 */
  webinarFeedbackSubmit: 'caira/webinar_feedback_submit/',

  // -------------------------------------------------------------------------
  // Auth — web routes only. No trailing slashes on any of these.
  // -------------------------------------------------------------------------

  /** #33 · POST · the only throttled endpoint (per client IP) */
  loginWithEmailPassword: 'web/login-with-email-password',

  /** #34 · POST · refuses `communication_method: 5` and strips `otp_dev` */
  loginWithPhoneOtp: 'web/login-with-phone-otp',

  /** #35 · POST · unthrottled · has the 403 `PROFILE_INCOMPLETE` gate */
  verifyOtp: 'web/verify-otp',

  /** #36 · POST · browser starts the QR handshake with its public key */
  qrInitiate: 'qr/initiate',

  /** #37 · POST · **the phone's call** — auth required. Not implemented in this client. */
  qrClaim: 'qr/claim',

  /** #38 · POST · single-use; 3-attempt lockout then 429 */
  qrConfirm: 'qr/confirm',

  /** #41 · POST · refresh token in the **body**, not a header. Response shape is opaque. */
  refresh: 'refresh',

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  /** #42 · GET only — a POST 405s · `sso_*` + `mo_*` prefixed, 19 keys */
  status: 'v2/status',

  /** #43 · POST · partial update · email changes go through a verification gate */
  updateUser: 'v2/update',

  /** #44 · POST · `{ firstName, lastName }` · no 404 — a missing row is a silent no-op */
  updateCertificateName: 'v2/update_name_for_certificate_generation',

  /** #45 · GET · returns only `first_name` + `last_name`; `name` is NOT returned */
  getCertificateName: 'v2/get_name_for_certificate_generation',

  /** #46 · POST · **no body** · soft delete only */
  removeAccount: 'remove',

  /** #47 · GET · POST · **trailing slash required** */
  registerDevice: 'register-device/',

  /** #48 · GET · `?country=<prefix>` · prefix match, no auth declared */
  country: 'country',

  /** #49 · GET · read-through to the SSO. **Not** an upload endpoint — none exists. */
  avatar: 'avatar',

  /** #50 · GET · **trailing slash required** · flat 18-key identity read */
  chatbotUserDetails: 'chatbot/user_details/',

  // -------------------------------------------------------------------------
  // Parity additions
  //
  // Endpoints the shipped CAIRA LMS (`CAIRA-LMS-2026`) calls in production that
  // the 50-endpoint API reference does not document. Read off
  // `CairaReadyService` / `CairaStatusService` there; see
  // `prompts/caira-lms-parity-binding.md` §2.2. Numbered `L*` so they cannot be
  // mistaken for reference endpoints.
  // -------------------------------------------------------------------------

  /**
   * L1 · GET · the CAIRA level tabs, as a
   * `{ levels: [{ sections: [{ items }] }] }` tree under the boolean-status
   * envelope.
   *
   * `?type=<section name>` narrows to one named section; the LMS reads it twice
   * — once bare for the tabs, once with `Frequently Asked Questions` for the FAQ
   * accordion. Two resources, not one read plus a client-side filter: the server
   * decides what a section is, and the FAQ repeats per level.
   */
  levelsPage: 'caira/masterclass/levels-page/',

  /**
   * L2 · GET · the post-login gate — maintenance window, pathway, onboarding.
   *
   * **Polarity is inverted from what the names suggest** (confirmed with the
   * backend): an all-true response is the happy learner. Read
   * `is_web_maintenance`, never `is_maintenance` — the latter is the mobile
   * app's window and is true during releases the web LMS is unaffected by.
   */
  appStatus: 'web/app-status/',

  /**
   * L3 · POST · **no body** · `?webinar_id=<pk>&event_type=webinar`.
   *
   * Registration is asynchronous. This returns `{ status: "accepted",
   * registration_status, attempt_id, status_url }` and the work finishes in the
   * background; poll `webinarRegisterStatus` with the `attempt_id`.
   *
   * This is the endpoint `docs/CAIRA_GAPS.md` G-23 records as having no binding
   * target. It exists — it is simply absent from the API reference.
   */
  webinarRegister: 'registerV4/',

  /** L4 · GET · poll one async registration attempt. `attempt_id` is a string. */
  webinarRegisterStatus: (attemptId: string) => `registerV4/${attemptId}/status/`,

  /**
   * L5 · POST · Salesforce activity relay, `{ activity_type, event_parameters }`.
   *
   * Fire-and-forget: every caller in the LMS ignores the response, and a failure
   * must never block a UI transition. Bind it with `SKIP_ERROR_NOTIFICATION`.
   */
  activityEvent: 'milesone-activity',
} as const;

/**
 * Routes that must never carry an `Authorization` header, and must never
 * trigger a refresh-and-retry.
 *
 * `web/*` and `qr/*` are pre-token by design; `refresh` is the call that mints
 * the new token, so retrying it on failure would recurse. The interceptors read
 * this rather than substring-matching a URL — the old code's
 * `req.url.includes('refresh_token')` stopped matching the moment the path
 * became `refresh`, silently disabling the loop guard.
 */
export const CAIRA_PUBLIC_ROUTES: readonly string[] = [
  CAIRA.loginWithEmailPassword,
  CAIRA.loginWithPhoneOtp,
  CAIRA.verifyOtp,
  CAIRA.qrInitiate,
  CAIRA.qrConfirm,
  CAIRA.refresh,
  CAIRA.country,
];

/** Whether a resolved URL points at one of the pre-token routes above. */
export function isPublicCairaRoute(url: string): boolean {
  const path = url.split('?')[0].replace(/\/+$/, '');
  return CAIRA_PUBLIC_ROUTES.some((route) => path.endsWith(route.replace(/\/+$/, '')));
}

/**
 * Whether a request should carry the learner's access token.
 *
 * Lives here rather than in `appInterceptor` for two reasons: the rule is about
 * routes, and keeping it in a module with no Angular imports means it can be
 * unit-tested without booting the framework. Sending a bearer token to the
 * wrong origin is the kind of bug that stays invisible until it is a
 * disclosure, so it gets a test rather than a code review.
 */
export function shouldAttachToken(url: string, baseUrl: string, skipFlag: boolean): boolean {
  if (skipFlag) return false;
  // Allowlist, not blocklist: only the configured CAIRA origin, never WordPress,
  // S3, CloudFront or anything else a caller passes as an absolute URL. The
  // interceptor this replaces attached to everything that did not opt out, so a
  // forgotten skip flag was a disclosure.
  if (!url.startsWith(baseUrl)) return false;
  // Pre-token routes reject a token anyway, and `qr/confirm` is public.
  return !isPublicCairaRoute(url);
}

/**
 * Deliberately absent — do not add without a security review:
 *
 * - **#39 `login-with-phone-otp` / #40 `verify-otp`** (unprefixed, mobile). #39
 *   returns the generated OTP in `result.otp_dev` to any anonymous caller, for
 *   any phone number, with no throttle, and #40 has no profile-completion gate.
 *   The `web/*` twins above exist precisely to close both holes.
 * - **`caira/*_lms` endpoints.** They authenticate with a shared API key;
 *   shipping that key to a browser would expose an unauthenticated read of all
 *   CAIRA content.
 * - **`devops_api/*`.** Server-side only.
 */

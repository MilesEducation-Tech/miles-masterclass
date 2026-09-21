/**
 * Canonical analytics event-name registry — the single source of truth.
 *
 * `Analytics.trackEvent` is typed to {@link AnalyticsEvent}, so a typo in a call
 * site is a compile error rather than a junk GA4/Netcore event. Keep this in
 * sync with `ANALYTICS_MEASUREMENT_PLAN.md` §4.
 */
export const ANALYTICS_EVENTS = [
  // Acquisition / system
  'virtual_page_view',
  'element_click',
  'consent_update',
  'user_data',
  // Activation
  'otp_requested',
  'login',
  'sign_up',
  'profile_completed',
  'logout',
  // Account lifecycle (CPE-Masterclass parity — GA4 user-property events).
  // Fired by Analytics.trackAccountCreate / trackOnboarding / trackProfileUpdate.
  'account_create',
  'onboarding',
  'profile_update',
  // Discovery
  'view_item',
  'view_instructor',
  'search',
  'bookmark_add',
  'bookmark_remove',
  // Learning
  'start_course',
  'chapter_complete',
  'course_complete',
  'video_start',
  'video_progress',
  'video_complete',
  // Assessment / feedback / CPE value
  'assessment_start',
  'assessment_submit',
  'feedback_submit',
  'certificate_download',
  'badge_claim',
  // Commerce
  'add_to_cart',
  'cart_view',
  'begin_checkout',
  'purchase',
  // Engagement / retention
  'webinar_register',
  'continue_learning_click',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

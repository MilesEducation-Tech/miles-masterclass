/**
 * Content fields the CPE-mode gate reads. Typed structurally rather than as
 * `ContentDetails` so micro-learning reels — which carry `is_free` but no
 * `active_plan` — satisfy it without a cast.
 */
export interface CpeModeGateContent {
  is_free?: boolean;
  active_plan?: unknown;
}

/**
 * May the user enter CPE Certification Mode for this content?
 *
 * CPE mode is the paid tier — it awards credit and a certificate — so it needs
 * an active subscription. Preview mode is free and is never gated by this.
 * Free content and content bought individually (`active_plan`) are exempt.
 *
 * A pure function taking `hasActivePlan` rather than reading `Auth` directly,
 * mirroring `needsSubscription` in `webinar-status.ts`: it keeps the rule
 * testable without a TestBed and puts it in one place instead of an inline
 * `||` chain repeated at five call sites.
 */
export function canAccessCpeMode(content: CpeModeGateContent, hasActivePlan: boolean): boolean {
  return hasActivePlan || !!content.is_free || !!content.active_plan;
}

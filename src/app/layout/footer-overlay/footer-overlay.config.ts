/**
 * Configuration for the `<app-footer-overlay/>` shell.
 *
 * The route allowlist is matched against the current URL with the
 * `:country/:profession_type` prefix stripped, so entries are plain feature
 * paths like `'home'` or `'library/course-library'`. To enable the bar on a
 * new route, add the post-locale path here — no other change required.
 */

export const SCROLL_THRESHOLD_PX = 500;

export const FOOTER_OVERLAY_ROUTES = [
  'home',
  'masterclass',
  'podcast',
  'micro-learning',
  'library/instructor-library',
  'library/badge-library',
  'library/course-library',
  'cpe-for-corporate',
] as const;

/**
 * Routes where the "Continue Learning" card is allowed. Intentionally
 * narrower than `FOOTER_OVERLAY_ROUTES`: matched via exact-equality (see
 * `isExactRoute`) so the card only appears on the listing/home page of each
 * offering — never on course detail (`masterclass/:id/:title`), chapter
 * deeplinks, or final-assessment routes.
 */
export const CONTINUE_CARD_ROUTES = ['masterclass', 'podcast', 'micro-learning'] as const;

/**
 * Route where the subscribe upsell is swapped for the B2B "bring it to your
 * firm" CTA. Matched via exact-equality (see `isExactRoute`) — the corporate
 * landing page has no child routes.
 */
export const CORPORATE_CARD_ROUTES = ['cpe-for-corporate'] as const;

export const SUBSCRIBE_CARD_COPY = {
  title: "Finally, CPE that's all about AI in Accounting",
  subtitle:
    'Get exclusive access to practical AI and analytics training for accountants. Earn NASBA-approved CPE credits as you learn.',
  cta: 'Subscribe',
} as const;

export const CORPORATE_CARD_COPY = {
  title: 'Bring the Miles Masterclass to Your Firm',
  subtitle:
    'Want your firm to access AI-focused, Hollywood-style CPE? Book a 30-minute session with us to explore how we can elevate your firm’s learning ecosystem.',
  cta: 'Schedule Discovery Call',
} as const;

/**
 * Returns true when `url` (a `router.url`-style path) matches one of the
 * allowlist entries. The leading `/:country/:profession_type/` segments are
 * dropped before comparing; matches are exact or segment-prefix (so
 * `'library/course-library'` matches itself and its descendants, but
 * `'library'` would not accidentally match a sibling like `'library-faq'`).
 */
export function isAllowedRoute(url: string, allow: readonly string[]): boolean {
  if (!url) return false;
  const path = url.split('?')[0].split('#')[0];
  const segments = path.replace(/^\/+/, '').split('/').filter(Boolean);
  if (segments.length < 3) return false;
  const tail = segments.slice(2).join('/');
  return allow.some((prefix) => tail === prefix || tail.startsWith(prefix + '/'));
}

/**
 * Like `isAllowedRoute` but exact-only — no prefix match. Used by the
 * Continue Learning card so it doesn't bleed into course detail / deeplink
 * routes that sit under the same offering segment.
 */
export function isExactRoute(url: string, allow: readonly string[]): boolean {
  if (!url) return false;
  const path = url.split('?')[0].split('#')[0];
  const segments = path.replace(/^\/+/, '').split('/').filter(Boolean);
  if (segments.length < 3) return false;
  const tail = segments.slice(2).join('/');
  return allow.some((prefix) => tail === prefix);
}

/**
 * Skip global keyboard shortcuts (e.g. cmd+K) when the user is currently
 * typing into an editable element. Without this, the shortcut would steal
 * focus from inputs/textareas/contenteditable regions across the app.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

import { SectionNavItem } from '@core/services/section-nav/section-nav';

/** The tracks wrapper; its entry shows only once there is a track to scroll to. */
export const MASTERCLASS_TRACKS_SECTION_ID = 'masterclass-tracks';

/**
 * The masterclass page's sidenav. Each `id` is an element the page renders —
 * `SectionNav` resolves them with `getElementById`, so an id with no element is
 * a dead link. The rails these used to include (Continue Watching, My List,
 * Completed, Coming Soon) left the page with their APIs; add an entry back
 * only with the section it points at.
 */
export const MASTERCLASS_SECTION_NAV: readonly SectionNavItem[] = [
  { id: 'masterclass-home', label: 'Home', visible: true, icon: 'lucideHome' },
  { id: MASTERCLASS_TRACKS_SECTION_ID, label: 'Tracker', visible: false, icon: 'lucideLayers' },
  { id: 'masterclass-faq', label: 'FAQ', visible: true, icon: 'lucideHelpCircle' },
];

/** The course page's About section; its entry shows once the course has loaded. */
export const MASTERCLASS_COURSE_ABOUT_SECTION_ID = 'about';

/**
 * The course page's inline nav. Masterclass (chapters), Resource and Related
 * are left out until their sections return with web-API endpoints — see
 * `docs/MASTERCLASS_API_QUESTIONS.md`.
 */
export const MASTERCLASS_COURSE_SECTION_NAV: readonly SectionNavItem[] = [
  { id: MASTERCLASS_COURSE_ABOUT_SECTION_ID, label: 'About', visible: false },
  { id: 'faq', label: 'FAQ', visible: true },
];

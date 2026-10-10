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

/** The course page's sections, by the element id each nav entry scrolls to. */
export const MASTERCLASS_COURSE_SECTION_IDS = {
  chapters: 'masterclass',
  resources: 'resource',
  about: 'about',
  related: 'related',
  faq: 'faq',
} as const;

/**
 * The course page's inline nav, in production's order. Every entry but FAQ
 * shows only once its section has something to render.
 */
export const MASTERCLASS_COURSE_SECTION_NAV: readonly SectionNavItem[] = [
  { id: MASTERCLASS_COURSE_SECTION_IDS.chapters, label: 'Masterclass', visible: false },
  { id: MASTERCLASS_COURSE_SECTION_IDS.resources, label: 'Resource', visible: false },
  { id: MASTERCLASS_COURSE_SECTION_IDS.about, label: 'About', visible: false },
  { id: MASTERCLASS_COURSE_SECTION_IDS.related, label: 'Related', visible: false },
  { id: MASTERCLASS_COURSE_SECTION_IDS.faq, label: 'FAQ', visible: true },
];

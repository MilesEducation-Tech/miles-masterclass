import { NavItem } from '@core/models/nav.model';

// `label`, `subLabel` and `badge` are translation keys (`src/i18n/<lang>.json`); the header
// translates them once, since the language is fixed for the life of the page.

const LIBRARY_CHILDREN: readonly NavItem[] = [
  { label: 'nav.courseLibrary', type: 'link', route: 'library/course-library' },
  // { label: 'Badge Library', type: 'link', route: 'library/badge-library' },
  { label: 'nav.instructorLibrary', type: 'link', route: 'library/instructor-library' },
];

/**
 * Nav for authenticated users.
 * `CPE Tracker` is gated behind `requires: 'activePlan'` — the header filters
 * items whose requirement is unmet, so guests-without-plan and trial users
 * never see the link until they have an active subscription.
 */
export const LOGGED_IN_NAV: readonly NavItem[] = [
  {
    label: 'nav.masterClass',
    subLabel: 'nav.masterClassSub',
    type: 'link',
    route: 'masterclass',
  },
  // { label: 'CAIRA', type: 'link', route: 'caira' },
  { label: 'nav.webinar', subLabel: 'nav.webinarSub', type: 'link', route: 'webinar' },
  { label: 'nav.reels', subLabel: 'nav.reelsSub', type: 'link', route: 'micro-learning' },
  { label: 'nav.podcast', subLabel: 'nav.podcastSub', type: 'link', route: 'podcast' },
  { label: 'nav.simulation', subLabel: 'nav.simulationSub', type: 'link', route: 'simulation' },
  {
    label: 'nav.resources',
    type: 'menu',
    children: [
      { label: 'nav.cairaBadges', type: 'link', route: 'caira-tracker' },
      { label: 'nav.cpeTracker', type: 'link', route: 'cpe-tracker' },
      { label: 'nav.plan', type: 'link', route: 'payment/plan' },
      {
        label: 'nav.library',
        type: 'menu',
        children: LIBRARY_CHILDREN,
      },
    ],
  },
  { label: 'nav.aiLabs', type: 'button', route: 'ai-labs', style: 'demo', badge: 'nav.beta' },
];

/** Nav for unauthenticated visitors. */
export const GUEST_NAV: readonly NavItem[] = [
  {
    label: 'nav.cpeSolutions',
    type: 'menu',
    children: [
      { label: 'nav.individualLearners', type: 'link', route: 'home' },
      { label: 'nav.enterpriseSolutions', type: 'link', route: 'cpe-for-corporate' },
    ],
  },
  // { label: 'CAIRA', type: 'link', route: 'caira' },
  { label: 'nav.webinar', subLabel: 'nav.webinarSub', type: 'link', route: 'webinar' },
  {
    label: 'nav.learningModes',
    type: 'menu',
    children: [
      {
        label: 'nav.masterClass',
        subLabel: 'nav.masterClassSub',
        type: 'link',
        route: 'masterclass',
      },
      { label: 'nav.reels', subLabel: 'nav.reelsSub', type: 'link', route: 'micro-learning' },
      { label: 'nav.podcast', subLabel: 'nav.podcastSub', type: 'link', route: 'podcast' },
    ],
  },
  {
    label: 'nav.resources',
    type: 'menu',
    children: [
      { label: 'nav.plan', type: 'link', route: 'payment/plan' },
      { label: 'nav.library', type: 'menu', children: LIBRARY_CHILDREN },
    ],
  },
  { label: 'nav.aiLabs', type: 'button', route: 'ai-labs', style: 'demo', badge: 'nav.beta' },
  { label: 'nav.signUp', type: 'button', actionKind: 'signup', style: 'signup' },
];

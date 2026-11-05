import { NavItem } from '@core/models/nav.model';

// `label`, `subLabel` and `badge` are translation keys (`src/i18n/<lang>.json`); the header
// translates them once, since the language is fixed for the life of the page.

const LIBRARY_CHILDREN: readonly NavItem[] = [
  { label: 'nav.courseLibrary', type: 'link', route: 'library/course-library' },
  // { label: 'Badge Library', type: 'link', route: 'library/badge-library' },
  { label: 'nav.instructorLibrary', type: 'link', route: 'library/instructor-library' },
];

/**
 * Nav for authenticated users. Every item shows to every signed-in learner: `CPE Tracker`
 * stays in the menu without a subscription, and its route (`subscriptionGuard`) sends a learner
 * who has none to the plan page. `requires: 'activePlan'` would hide an item instead.
 */
export const LOGGED_IN_NAV: readonly NavItem[] = [
  {
    label: 'nav.masterClass',
    subLabel: 'nav.masterClassSub',
    type: 'link',
    route: 'masterclass',
  },
  { label: 'nav.aiLabs', type: 'link', route: 'ai-labs', highlight: true },
  // { label: 'CAIRA', type: 'link', route: 'caira' },
  { label: 'nav.webinar', subLabel: 'nav.webinarSub', type: 'link', route: 'webinar' },
  { label: 'nav.reels', subLabel: 'nav.reelsSub', type: 'link', route: 'micro-learning' },
  { label: 'nav.podcast', subLabel: 'nav.podcastSub', type: 'link', route: 'podcast' },
  // { label: 'Simulation', subLabel: '(AI Role-play)', type: 'link', route: 'simulation' },
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
];

/** Nav for unauthenticated visitors. */
export const GUEST_NAV: readonly NavItem[] = [
  { label: 'nav.home', type: 'link', route: 'home' },
  { label: 'nav.aiLabs', type: 'link', route: 'ai-labs', highlight: true },
  { label: 'nav.webinar', subLabel: 'nav.webinarSub', type: 'link', route: 'webinar' },
  { label: 'nav.plans', type: 'link', route: 'payment/plan' },
  // {
  //   label: 'nav.cpeSolutions',
  //   type: 'menu',
  //   children: [
  //     { label: 'nav.individualLearners', type: 'link', route: 'home' },
  //     { label: 'nav.enterpriseSolutions', type: 'link', route: 'cpe-for-corporate' },
  //   ],
  // },
  // { label: 'CAIRA', type: 'link', route: 'caira' },
  {
    label: 'nav.resources',
    type: 'menu',
    children: [
      { label: 'nav.enterpriseSolutions', type: 'link', route: 'cpe-for-corporate' },
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
      { label: 'nav.library', type: 'menu', children: LIBRARY_CHILDREN },
    ],
  },
  { label: 'nav.signUp', type: 'button', actionKind: 'signup', style: 'signup' },
];

import { NavItem } from '../../shared/core/models/nav.model';

const LIBRARY_CHILDREN: readonly NavItem[] = [
  { label: 'Course Library', type: 'link', route: 'library/course-library' },
  { label: 'Badge Library', type: 'link', route: 'library/badge-library' },
  { label: 'Instructor Library', type: 'link', route: 'library/instructor-library' },
];

/**
 * Nav for authenticated users.
 * `CPE Tracker` is gated behind `requires: 'activePlan'` — the header filters
 * items whose requirement is unmet, so guests-without-plan and trial users
 * never see the link until they have an active subscription.
 */
export const LOGGED_IN_NAV: readonly NavItem[] = [
  {
    label: 'Master Class',
    subLabel: '(Netflix style Courses)',
    type: 'link',
    route: 'masterclass',
  },
  // { label: 'CAIRA', type: 'link', route: 'caira' },
  { label: 'Webinar', subLabel: '(Premiere)', type: 'link', route: 'webinar' },
  { label: 'Reels', subLabel: '(Micro Learning)', type: 'link', route: 'micro-learning' },
  { label: 'Podcast', subLabel: '(Audio Courses)', type: 'link', route: 'podcast' },
  {
    label: 'Resources',
    type: 'menu',
    children: [
      { label: 'CPE Tracker', type: 'link', route: 'cpe-tracker' },
      { label: 'Plan', type: 'link', route: 'payment/plan' },
      {
        label: 'Library',
        type: 'menu',
        children: LIBRARY_CHILDREN,
      },
    ],
  },
  { label: 'Miles AI Labs', type: 'button', route: 'ai-labs', style: 'demo', badge: 'Beta' },
];

/** Nav for unauthenticated visitors. */
export const GUEST_NAV: readonly NavItem[] = [
  {
    label: 'CPE Solutions',
    type: 'menu',
    children: [
      { label: 'Individual Learners', type: 'link', route: 'home' },
      { label: 'Enterprise Solutions', type: 'link', route: 'cpe-for-corporate' },
    ],
  },
  // { label: 'CAIRA', type: 'link', route: 'caira' },
  { label: 'Webinar', subLabel: '(Premiere)', type: 'link', route: 'webinar' },
  {
    label: 'Learning Modes',
    type: 'menu',
    children: [
      {
        label: 'Master Class',
        subLabel: '(Netflix style Courses)',
        type: 'link',
        route: 'masterclass',
      },
      { label: 'Reels', subLabel: '(Micro Learning)', type: 'link', route: 'micro-learning' },
      { label: 'Podcast', subLabel: '(Audio Courses)', type: 'link', route: 'podcast' },
    ],
  },
  {
    label: 'Resources',
    type: 'menu',
    children: [
      { label: 'Plan', type: 'link', route: 'payment/plan' },
      { label: 'Library', type: 'menu', children: LIBRARY_CHILDREN },
    ],
  },
  { label: 'Miles AI Labs', type: 'button', route: 'ai-labs', style: 'demo', badge: 'Beta' },
  { label: 'Sign Up', type: 'button', actionKind: 'signup', style: 'signup' },
];

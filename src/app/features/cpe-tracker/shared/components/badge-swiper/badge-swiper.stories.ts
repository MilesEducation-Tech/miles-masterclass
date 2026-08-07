import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { BadgeSwiper } from './badge-swiper';
import { BadgeItem } from '../../../../../shared/core/models/cpe-tracker.model';

const sampleBadges: BadgeItem[] = [
  {
    id: 1,
    name: 'CAIRA — Level 1',
    sub_text: 'Foundations of AI in Accounting',
    description: 'Gain a solid foundation in AI for accounting workflows.',
    image_url:
      'https://milesmasterclass-assets.s3.us-west-1.amazonaws.com/static-assests/credly-badges/AI+Prompting+Essentials+for+Accountants.png',
    level: 'Level 1',
    level_rank: 1,
    required_credits: 30,
    earned_credits: 30,
    progress_percentage: 100,
    status: 'unlocked',
    is_claimed: true,
    is_claimable: false,
    is_coming_soon: false,
  },
  {
    id: 2,
    name: 'AI-Ready Auditor — Level 2',
    sub_text: 'Apply AI to audit workflows',
    description: 'Two ethics courses completed and audit AI fundamentals in place.',
    image_url:
      'https://milesmasterclass-assets.s3.us-west-1.amazonaws.com/static-assests/credly-badges/AI-Ready+Auditors.png',
    level: 'Level 2',
    level_rank: 2,
    required_credits: 30,
    earned_credits: 30,
    progress_percentage: 100,
    status: 'unlocked',
    is_claimed: false,
    is_claimable: true,
    is_coming_soon: false,
  },
  {
    id: 3,
    name: 'AI Architect — Level 3',
    sub_text: 'Design AI systems for finance',
    description: 'Earn 40 CPE credits in advanced AI applications.',
    image_url:
      'https://milesmasterclass-assets.s3.us-west-1.amazonaws.com/static-assests/credly-badges/Digits+Certified+Accountant.png',
    level: 'Level 3',
    level_rank: 3,
    required_credits: 40,
    earned_credits: 26,
    progress_percentage: 65,
    status: 'unlocked',
    is_claimed: false,
    is_claimable: false,
    is_coming_soon: false,
  },
  {
    id: 4,
    name: 'AI Strategist — Level 4',
    sub_text: 'Reserved for top performers',
    description: 'Coming soon.',
    image_url:
      'https://milesmasterclass-assets.s3.us-west-1.amazonaws.com/static-assests/credly-badges/Ethics+in+AI-Enhanced+Accounting.png',
    level: 'Level 4',
    level_rank: 1,
    required_credits: 0,
    earned_credits: 0,
    progress_percentage: 0,
    status: 'locked',
    is_claimed: false,
    is_claimable: false,
    is_coming_soon: true,
  },
];

const meta: Meta<BadgeSwiper> = {
  title: 'CPE Tracker/Badge Swiper',
  component: BadgeSwiper,
  tags: ['autodocs'],
  render: (args) => ({
    props: args,
    template: `<div style="background: black; max-width: 1200px;"><app-badge-swiper ${argsToTemplate(args)}></app-badge-swiper></div>`,
  }),
};

export default meta;
type Story = StoryObj<BadgeSwiper>;

export const Default: Story = {
  args: {
    badges: sampleBadges,
  },
};

export const SingleClaimable: Story = {
  args: {
    badges: [sampleBadges[1]],
  },
};

export const SingleLocked: Story = {
  args: {
    badges: [sampleBadges[2]],
  },
};

export const Empty: Story = {
  args: {
    badges: [],
  },
};

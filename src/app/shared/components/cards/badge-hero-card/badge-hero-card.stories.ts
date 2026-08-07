import { argsToTemplate, type Meta, type StoryObj } from '@storybook/angular';
import { BadgeHeroCard } from './badge-hero-card';

const baseBadge: any = {
  id: 1,
  name: 'CAIRA — Level 1',
  sub_text: 'Foundations of AI in Accounting',
  description: 'Gain a solid foundation in AI for accounting workflows.',
  image_url:
    'https://milesmasterclass-assets.s3.us-west-1.amazonaws.com/static-assests/credly-badges/AI+Prompting+Essentials+for+Accountants.png',
  level: 'Level 1',
  level_rank: 1,
  required_credits: 30,
  earned_credits: 7.5,
  progress_percentage: 25,
  status: 'unlocked',
  is_claimed: false,
  is_claimable: false,
  is_coming_soon: false,
};

const meta: Meta<BadgeHeroCard> = {
  title: 'CPE Tracker/BadgeHeroCard',
  component: BadgeHeroCard,
  tags: ['autodocs'],
  render: (args) => ({
    props: args,
    template: `<div style="background: black; padding: 24px;"><app-badge-hero-card ${argsToTemplate(args)}></app-badge-hero-card></div>`,
  }),
};
export default meta;

type Story = StoryObj<BadgeHeroCard>;

export const HeroLocked: Story = {
  args: { badge: baseBadge, layout: 'hero' },
};

export const HeroClaimable: Story = {
  args: {
    badge: { ...baseBadge, is_claimable: true, progress_percentage: 100, earned_credits: 30 },
    layout: 'hero',
  },
};

export const HeroClaimed: Story = {
  args: {
    badge: { ...baseBadge, is_claimed: true, progress_percentage: 100, earned_credits: 30 },
    layout: 'hero',
  },
};

export const HeroComingSoon: Story = {
  args: {
    badge: { ...baseBadge, is_coming_soon: true },
    layout: 'hero',
  },
};

export const GridLocked: Story = {
  args: { badge: baseBadge, layout: 'grid' },
};

export const GridClaimable: Story = {
  args: {
    badge: { ...baseBadge, is_claimable: true, progress_percentage: 100, earned_credits: 30 },
    layout: 'grid',
  },
};

export const GridClaimed: Story = {
  args: {
    badge: { ...baseBadge, is_claimed: true, progress_percentage: 100, earned_credits: 30 },
    layout: 'grid',
  },
};

export const GridComingSoon: Story = {
  args: {
    badge: { ...baseBadge, is_coming_soon: true },
    layout: 'grid',
  },
};

export const GridLevel2Silver: Story = {
  args: {
    badge: {
      ...baseBadge,
      name: 'AI-Ready Auditor — Level 2',
      level: 'Level 2',
      level_rank: 2,
      progress_percentage: 60,
      earned_credits: 18,
    },
    layout: 'grid',
  },
};

export const GridLevel3Gold: Story = {
  args: {
    badge: {
      ...baseBadge,
      name: 'AI Architect — Level 3',
      level: 'Level 3',
      level_rank: 3,
      is_claimable: true,
      progress_percentage: 100,
      earned_credits: 30,
    },
    layout: 'grid',
  },
};

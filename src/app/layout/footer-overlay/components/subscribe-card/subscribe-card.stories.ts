import type { Meta, StoryObj } from '@storybook/angular';
import { SubscribeCard } from './subscribe-card';
import { SUBSCRIBE_CARD_COPY } from '../../footer-overlay.config';

const meta: Meta<SubscribeCard> = {
  title: 'Layout/FooterOverlay/SubscribeCard',
  component: SubscribeCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    title: SUBSCRIBE_CARD_COPY.title,
    subtitle: SUBSCRIBE_CARD_COPY.subtitle,
    ctaLabel: SUBSCRIBE_CARD_COPY.cta,
  },
};

export default meta;
type Story = StoryObj<SubscribeCard>;

export const Default: Story = {};

export const CustomCopy: Story = {
  args: {
    title: 'Unlock unlimited learning',
    subtitle: 'Subscribe today to access all courses, podcasts, and reels.',
    ctaLabel: 'Start free trial',
  },
};

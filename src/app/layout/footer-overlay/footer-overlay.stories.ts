import type { Meta, StoryObj } from '@storybook/angular';
import { FooterOverlay } from './footer-overlay';

/**
 * The host component pulls in Router, Auth, PaymentFacade and FeatureFacade,
 * so a fully-functional story would need a Storybook decorator that mocks all
 * of them. For now we expose the empty mount-point story; the individual
 * states are covered by the sub-component stories under
 * `components/<name>/<name>.stories.ts`.
 */
const meta: Meta<FooterOverlay> = {
  title: 'Layout/FooterOverlay',
  component: FooterOverlay,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<FooterOverlay>;

export const Default: Story = {};

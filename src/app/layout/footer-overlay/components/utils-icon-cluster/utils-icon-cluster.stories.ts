import type { Meta, StoryObj } from '@storybook/angular';
import { UtilsIconCluster } from './utils-icon-cluster';

const meta: Meta<UtilsIconCluster> = {
  title: 'Layout/FooterOverlay/UtilsIconCluster',
  component: UtilsIconCluster,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Vertical column of floating icon buttons (cart + search). The cart button is hidden for guests.',
      },
    },
  },
  args: {
    cartCount: 3,
  },
};

export default meta;
type Story = StoryObj<UtilsIconCluster>;

export const Default: Story = {};

export const EmptyCart: Story = {
  args: { cartCount: 0 },
};

export const HighCartCount: Story = {
  args: { cartCount: 142 },
};

export const LoggedOut: Story = {
  args: { cartCount: 0, showCart: false },
  parameters: {
    docs: {
      description: {
        story: 'Guest user — cart is hidden; only the search icon is rendered.',
      },
    },
  },
};

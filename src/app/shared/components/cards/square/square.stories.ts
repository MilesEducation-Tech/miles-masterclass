import type { Meta, StoryObj } from '@storybook/angular';
import { Square } from './square';

const meta: Meta<Square> = {
  title: 'Cards/Square',
  component: Square,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 250px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    thumbnail: { control: 'text', description: 'Image URL for the card thumbnail' },
    title: { control: 'text', description: 'Card title text' },
    index: { control: 'number', description: 'Card index for styling' },
  },
};

export default meta;
type Story = StoryObj<Square>;

export const Default: Story = {
  args: {
    thumbnail: 'https://placehold.co/400x400/1a1a2e/ffffff?text=CPA',
    title: 'Advanced CPA Strategies',
    index: 0,
  },
};

export const SecondCard: Story = {
  args: {
    thumbnail: 'https://placehold.co/400x400/2d1b69/ffffff?text=CMA',
    title: 'CMA Preparation Guide',
    index: 1,
  },
};

export const NoTitle: Story = {
  args: {
    thumbnail: 'https://placehold.co/400x400/0d3b66/ffffff?text=Course',
    title: '',
    index: 2,
  },
};

export const Grid: Story = {
  render: () => ({
    template: `
      <div style="width: 600px;" class="grid grid-cols-3 gap-4">
        <app-square thumbnail="https://placehold.co/400x400/1a1a2e/ffffff?text=CPA" title="CPA" [index]="0" />
        <app-square thumbnail="https://placehold.co/400x400/2d1b69/ffffff?text=CMA" title="CMA" [index]="1" />
        <app-square thumbnail="https://placehold.co/400x400/0d3b66/ffffff?text=EA" title="EA" [index]="2" />
        <app-square thumbnail="https://placehold.co/400x400/1b4332/ffffff?text=CIA" title="CIA" [index]="3" />
        <app-square thumbnail="https://placehold.co/400x400/4a1942/ffffff?text=ACCA" title="ACCA" [index]="4" />
        <app-square thumbnail="https://placehold.co/400x400/5c2d91/ffffff?text=CFA" title="CFA" [index]="5" />
      </div>
    `,
  }),
};

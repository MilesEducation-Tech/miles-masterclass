import type { Meta, StoryObj } from '@storybook/angular';
import { ComingSoon } from './coming-soon';
import { MOCK_MASTERCLASS_CARD, MOCK_PODCAST_CARD } from '../../__mocks__/content.mock';

const meta: Meta<ComingSoon> = {
  title: 'Cards/ComingSoon',
  component: ComingSoon,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 300px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    card: { control: 'object', description: 'Card content data' },
    index: { control: 'number', description: 'Card position index' },
  },
};

export default meta;
type Story = StoryObj<ComingSoon>;

export const Default: Story = {
  args: {
    card: MOCK_MASTERCLASS_CARD,
    index: 0,
  },
};

export const SecondCard: Story = {
  args: {
    card: MOCK_PODCAST_CARD,
    index: 1,
  },
};

export const Row: Story = {
  render: () => ({
    props: {
      card1: MOCK_MASTERCLASS_CARD,
      card2: MOCK_PODCAST_CARD,
    },
    template: `
      <div style="width: 700px;" class="flex gap-4">
        <div style="width: 300px;"><app-coming-soon [card]="card1" [index]="0" /></div>
        <div style="width: 300px;"><app-coming-soon [card]="card2" [index]="1" /></div>
      </div>
    `,
  }),
};

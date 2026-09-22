import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Vertical } from './vertical';
import {
  MOCK_MASTERCLASS_CARD,
  MOCK_PODCAST_CARD,
  MOCK_MICROLEARNING_CARD,
} from '../../../../testing/mocks/content.mock';
import { MockUtils, MockFeatureFacade } from '../../../../testing/mocks/services.mock';
import { Utils } from '../../../core/services/utils/utils';
import { FeatureFacade } from '../../../../features/shared/services/feature-facade/feature-facade';

const meta: Meta<Vertical> = {
  title: 'Cards/Vertical',
  component: Vertical,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      providers: [
        { provide: Utils, useClass: MockUtils },
        { provide: FeatureFacade, useClass: MockFeatureFacade },
      ],
    }),
    (story) => ({
      template: `<div style="width: 300px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    type: {
      control: 'select',
      options: ['masterclass', 'podcast', 'micro-learning'],
      description: 'Course content type',
    },
  },
};

export default meta;
type Story = StoryObj<Vertical>;

export const Masterclass: Story = {
  args: {
    card: MOCK_MASTERCLASS_CARD,
    type: 'masterclass',
  },
};

export const Podcast: Story = {
  args: {
    card: MOCK_PODCAST_CARD,
    type: 'podcast',
  },
};

export const MicroLearning: Story = {
  args: {
    card: MOCK_MICROLEARNING_CARD,
    type: 'micro-learning',
  },
};

export const AllTypes: Story = {
  render: () => ({
    props: {
      masterclass: MOCK_MASTERCLASS_CARD,
      podcast: MOCK_PODCAST_CARD,
      micro: MOCK_MICROLEARNING_CARD,
    },
    template: `
      <div style="width: 900px;" class="flex gap-6">
        <div style="width: 280px;"><app-vertical [card]="masterclass" type="masterclass" /></div>
        <div style="width: 280px;"><app-vertical [card]="podcast" type="podcast" /></div>
        <div style="width: 280px;"><app-vertical [card]="micro" type="micro-learning" /></div>
      </div>
    `,
  }),
};

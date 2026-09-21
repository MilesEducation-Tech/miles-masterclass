import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Horizontal } from './horizontal';
import {
  MOCK_MASTERCLASS_CARD,
  MOCK_PODCAST_CARD,
  MOCK_MICROLEARNING_CARD,
} from '../../__mocks__/content.mock';
import { MockUtils, MockFeatureFacade, MockLogger } from '../../__mocks__/services.mock';
import { Utils } from '../../../core/services/utils/utils';
import { FeatureFacade } from '../../../../features/shared/services/feature-facade/feature-facade';
import { Logger } from '../../../core/services/logger/logger';

const meta: Meta<Horizontal> = {
  title: 'Cards/Horizontal',
  component: Horizontal,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      providers: [
        { provide: Utils, useClass: MockUtils },
        { provide: FeatureFacade, useClass: MockFeatureFacade },
        { provide: Logger, useClass: MockLogger },
      ],
    }),
    (story) => ({
      template: `<div style="width: 500px;">${story().template ?? ''}</div>`,
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
type Story = StoryObj<Horizontal>;

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

export const Stacked: Story = {
  render: () => ({
    props: {
      masterclass: MOCK_MASTERCLASS_CARD,
      podcast: MOCK_PODCAST_CARD,
      micro: MOCK_MICROLEARNING_CARD,
    },
    template: `
      <div style="width: 500px;" class="flex flex-col gap-4">
        <app-horizontal [card]="masterclass" type="masterclass" />
        <app-horizontal [card]="podcast" type="podcast" />
        <app-horizontal [card]="micro" type="micro-learning" />
      </div>
    `,
  }),
};

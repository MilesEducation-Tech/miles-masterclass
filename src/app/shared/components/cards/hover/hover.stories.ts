import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Hover } from './hover';
import {
  MOCK_MASTERCLASS_CARD,
  MOCK_PODCAST_CARD,
  MOCK_MICROLEARNING_CARD,
} from '../../__mocks__/content.mock';
import { MockUtils, MockFeatureFacade, MockLogger } from '../../__mocks__/services.mock';
import { Utils } from '../../../core/services/utils/utils';
import { FeatureFacade } from '../../../../features/shared/services/feature-facade/feature-facade';
import { Logger } from '../../../core/services/logger/logger';

const meta: Meta<Hover> = {
  title: 'Cards/Hover',
  component: Hover,
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
type Story = StoryObj<Hover>;

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

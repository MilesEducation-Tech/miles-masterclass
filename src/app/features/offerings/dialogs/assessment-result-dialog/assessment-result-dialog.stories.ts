import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { AssessmentResultDialog } from './assessment-result-dialog';
import { provideStoryDialogRef } from '@testing/mocks/dialog.mock';

const meta: Meta<AssessmentResultDialog> = {
  title: 'Dialog/AssessmentResult',
  component: AssessmentResultDialog,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 450px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
};

export default meta;
type Story = StoryObj<AssessmentResultDialog>;

export const Passed: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          isPassed: true,
          score: 85,
          message: 'Congratulations! You passed the assessment.',
          passingScore: 75,
        }),
      ],
    }),
  ],
  render: () => ({ template: `<div style="width: 450px;"><app-assessment-result-dialog /></div>` }),
};

export const Failed: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          isPassed: false,
          score: 60,
          message: 'You did not meet the passing score. You can retake the assessment.',
          passingScore: 75,
        }),
      ],
    }),
  ],
  render: () => ({ template: `<div style="width: 450px;"><app-assessment-result-dialog /></div>` }),
};

export const BarellyPassed: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          isPassed: true,
          score: 75,
          message: 'You passed! You met the minimum passing score.',
          passingScore: 75,
        }),
      ],
    }),
  ],
  render: () => ({ template: `<div style="width: 450px;"><app-assessment-result-dialog /></div>` }),
};

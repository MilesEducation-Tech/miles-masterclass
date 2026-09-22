import type { Meta, StoryObj } from '@storybook/angular';
import { AssessmentResultDialog } from './assessment-result-dialog';
import { MockDialogRef } from '../../../../testing/mocks/dialog.mock';

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
  render: () => ({
    props: {
      init(component: AssessmentResultDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          isPassed: true,
          score: 85,
          message: 'Congratulations! You passed the assessment.',
          passingScore: 75,
        };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-assessment-result-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const Failed: Story = {
  render: () => ({
    props: {
      init(component: AssessmentResultDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          isPassed: false,
          score: 60,
          message: 'You did not meet the passing score. You can retake the assessment.',
          passingScore: 75,
        };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-assessment-result-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const BarellyPassed: Story = {
  render: () => ({
    props: {
      init(component: AssessmentResultDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          isPassed: true,
          score: 75,
          message: 'You passed! You met the minimum passing score.',
          passingScore: 75,
        };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-assessment-result-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

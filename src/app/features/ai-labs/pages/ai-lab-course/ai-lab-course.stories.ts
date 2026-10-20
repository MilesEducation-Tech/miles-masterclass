import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig, argsToTemplate } from '@storybook/angular';
import { provideRouter } from '@angular/router';
import { AiLabCourse } from './ai-lab-course';
import { MOCK_CONTENT_DETAILS } from '@testing/mocks/content.mock';
import {
  MOCK_AI_LAB_AGENTS,
  MOCK_AI_LAB_BALANCE,
  MOCK_AI_LAB_BRIEF,
  MOCK_AI_LAB_EVALUATED,
  MOCK_AI_LAB_FLOWS,
} from '@testing/mocks/ai-labs.mock';

/**
 * The AI Lab course page.
 *
 * Nothing routes real data to it yet, so these stories are the only place the design can be seen.
 * The four gates — watch → quiz → exam → lab — are what the stories step through, because every
 * section below the hero is gated on one of them.
 */
const meta: Meta<AiLabCourse> = {
  title: 'AI Labs/Course page',
  component: AiLabCourse,
  tags: ['autodocs'],
  // The exam-report link is a `routerLink`, so the stories need a router to resolve it.
  decorators: [applicationConfig({ providers: [provideRouter([])] })],
  render: (args) => ({
    props: args,
    template: `<app-ai-lab-course ${argsToTemplate(args)}></app-ai-lab-course>`,
  }),
};

export default meta;
type Story = StoryObj<AiLabCourse>;

const course = MOCK_CONTENT_DETAILS;

/** Fresh start: video unwatched, everything downstream locked. */
export const NotStarted: Story = {
  args: {
    course,
    details: course,
    brief: MOCK_AI_LAB_BRIEF,
    labMapped: true,
    balance: MOCK_AI_LAB_BALANCE,
  },
};

/** Video done, assessment still to pass — the lab stays shut and says why. */
export const AwaitingExam: Story = {
  args: {
    course,
    details: course,
    brief: MOCK_AI_LAB_BRIEF,
    labMapped: true,
    completed: true,
    progress: 100,
    ctaStage: 'TAKE_EXAM',
    balance: MOCK_AI_LAB_BALANCE,
  },
};

/**
 * Exam passed, lab open, artefacts listed. The disabled flow in the fixture must not appear in
 * the workflow select.
 */
export const LabUnlocked: Story = {
  args: {
    course: {
      ...course,
      user_assessment_details: { ...course.user_assessment_details, status: 'Exam_Passed' },
    },
    details: course,
    brief: MOCK_AI_LAB_BRIEF,
    labMapped: true,
    completed: true,
    progress: 100,
    ctaStage: 'FEEDBACK',
    agents: MOCK_AI_LAB_AGENTS,
    flows: MOCK_AI_LAB_FLOWS,
    balance: MOCK_AI_LAB_BALANCE,
  },
};

/** An attempt is with the evaluator: the picker stays visible but nothing can be changed. */
export const Evaluating: Story = {
  args: {
    ...LabUnlocked.args,
    assignment: { lab_status: 'in_progress', submission_id: 'sub-9f21c8' },
  },
};

/** Scored. The learner can submit again to better it. */
export const Evaluated: Story = {
  args: { ...LabUnlocked.args, assignment: MOCK_AI_LAB_EVALUATED },
};

/** No assignment mapped — the lab is shut for a different reason, and says so. */
export const LabNotMapped: Story = {
  args: {
    course,
    details: course,
    labMapped: false,
    completed: true,
    progress: 100,
    ctaStage: 'FEEDBACK',
  },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const Errored: Story = {
  args: { error: true },
};

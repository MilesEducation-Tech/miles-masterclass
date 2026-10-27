import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideRouter } from '@angular/router';
import { AiLabExam } from './ai-lab-exam';
import {
  AiLabExamStoryState,
  MOCK_AI_LAB_DETAIL,
  MOCK_AI_LAB_EXAM_PAPER,
  MOCK_AI_LAB_EXAM_RESULT,
  provideStoryAiLabExam,
} from '@testing/mocks/ai-labs.mock';

/**
 * The lab's final assessment, on a stand-in `AiLabAssessmentFacade` (`provideStoryAiLabExam`):
 * the paper, the review a submit returns, and a refusal on the read.
 */
const meta: Meta<AiLabExam> = {
  title: 'AI Labs/Final assessment',
  component: AiLabExam,
  tags: ['autodocs'],
  // `app-backward` navigates through the router.
  decorators: [applicationConfig({ providers: [provideRouter([])] })],
  render: () => ({
    template: `<app-ai-lab-exam courseId="${MOCK_AI_LAB_DETAIL.id}" />`,
  }),
};

export default meta;
type Story = StoryObj<AiLabExam>;

const withState = (state: AiLabExamStoryState): Story => ({
  decorators: [moduleMetadata({ providers: [provideStoryAiLabExam(state)] })],
});

/** The paper, on its first (single-answer) question. */
export const Paper = withState({ paper: MOCK_AI_LAB_EXAM_PAPER });

/** A failed attempt's review beneath the result dialog: Retake, the score, every answer. */
export const FailedReview = withState({
  paper: MOCK_AI_LAB_EXAM_PAPER,
  result: MOCK_AI_LAB_EXAM_RESULT,
  sent: { b4fcae42: ['a01d062e'], c0f57881: ['82b00e71', '584d6a2c'] },
});

/** A pass: no Retake, the badge turns green. */
export const PassedReview = withState({
  paper: MOCK_AI_LAB_EXAM_PAPER,
  result: {
    ...MOCK_AI_LAB_EXAM_RESULT,
    passed: true,
    score_percent: 100,
    next_step: 'feedback',
    answers: MOCK_AI_LAB_EXAM_RESULT.answers.map((a) => ({ ...a, is_correct: true })),
  },
  sent: { b4fcae42: ['756fcf51'], c0f57881: ['82b00e71', '584d6a2c'] },
});

/** The read refused: inside the 30-minute cool-off after a failed attempt. */
export const CoolOff = withState({
  loadError: 'You can retake the assessment after 4:40 PM.',
});

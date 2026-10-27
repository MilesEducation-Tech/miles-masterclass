import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideRouter } from '@angular/router';
import { AiLabFeedback } from './ai-lab-feedback';
import {
  AiLabFeedbackStoryState,
  MOCK_AI_LAB_DETAIL,
  MOCK_AI_LAB_FEEDBACK_QUESTIONS,
  provideStoryAiLabFeedback,
} from '@testing/mocks/ai-labs.mock';

/** The lab's feedback, on a stand-in `AiLabFeedbackFacade` (`provideStoryAiLabFeedback`). */
const meta: Meta<AiLabFeedback> = {
  title: 'AI Labs/Feedback',
  component: AiLabFeedback,
  tags: ['autodocs'],
  decorators: [applicationConfig({ providers: [provideRouter([])] })],
  render: () => ({ template: `<app-ai-lab-feedback courseId="${MOCK_AI_LAB_DETAIL.id}" />` }),
};

export default meta;
type Story = StoryObj<AiLabFeedback>;

const withState = (state: AiLabFeedbackStoryState): Story => ({
  decorators: [moduleMetadata({ providers: [provideStoryAiLabFeedback(state)] })],
});

/** The form: four ratings (required) and one text question (optional). */
export const Form = withState({ questions: MOCK_AI_LAB_FEEDBACK_QUESTIONS });

/** The gate refused: the practical isn't graded yet. */
export const NotYet = withState({
  notYet: 'Pass the final assessment first — feedback opens once you do.',
});

/** Submitted: v3's short thank-you. The certificate is still generating, so no button. */
export const ThankYou = withState({
  done: {
    result: {
      feedback_submitted: true,
      already_submitted: false,
      cpe_awarded: 2,
      lab_certificate_triggered: true,
      lab_certificate_url: null,
      next_step: 'done',
    },
    notice: null,
  },
});

/** Recorded, but the lab couldn't close (409 `nasba_conditions_unmet`). */
export const RecordedNotClosed = withState({
  done: {
    result: null,
    notice:
      'Your feedback was recorded, but this AI Lab cannot be completed yet - some requirements are still outstanding.',
  },
});

import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideRouter } from '@angular/router';
import { AiLabQuizDialog } from './ai-lab-quiz-dialog';
import { provideStoryDialogRef } from '@testing/mocks/dialog.mock';
import {
  MOCK_AI_LAB_DETAIL,
  MOCK_AI_LAB_QUIZ,
  MOCK_AI_LAB_QUIZ_GRADE,
  MOCK_AI_LAB_STARTED,
  mockAiLabProgress,
  provideStoryAiLabCourse,
} from '@testing/mocks/ai-labs.mock';

/**
 * The lab quiz as the pop-up the course page opens (Take Quiz, or the video's end), on the story
 * stand-ins for `AiLabQuizFacade` and `AiLabCourseFacade`.
 */
const meta: Meta<AiLabQuizDialog> = {
  title: 'AI Labs/Quiz dialog',
  component: AiLabQuizDialog,
  decorators: [applicationConfig({ providers: [provideRouter([])] })],
  render: () => ({ template: `<app-ai-lab-quiz-dialog />` }),
};

export default meta;
type Story = StoryObj<AiLabQuizDialog>;

const at = (index: number, graded: boolean): Story => ({
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef(),
        provideStoryAiLabCourse({
          lab: MOCK_AI_LAB_DETAIL,
          started: MOCK_AI_LAB_STARTED,
          progress: mockAiLabProgress('quiz'),
          ctaStage: 'TAKE_QUIZ',
          quiz: {
            questions: MOCK_AI_LAB_QUIZ,
            index,
            grade: graded ? MOCK_AI_LAB_QUIZ_GRADE : null,
          },
        }),
      ],
    }),
  ],
});

/** The first question, unanswered. */
export const FirstQuestion = at(0, false);

/** Answered wrong: the verdict, the right option and each option's explanation. */
export const Graded = at(0, true);

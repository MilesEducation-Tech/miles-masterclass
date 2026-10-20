import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideRouter } from '@angular/router';
import { AiLabCourse } from './ai-lab-course';
import {
  AiLabCourseStoryState,
  MOCK_AI_LAB_AGENTS,
  MOCK_AI_LAB_BALANCE,
  MOCK_AI_LAB_BRIEF,
  MOCK_AI_LAB_DETAIL,
  MOCK_AI_LAB_EVALUATED,
  MOCK_AI_LAB_EVALUATING,
  MOCK_AI_LAB_FLOWS,
  MOCK_AI_LAB_NOT_STARTED,
  MOCK_AI_LAB_QUIZ,
  MOCK_AI_LAB_QUIZ_GRADE,
  MOCK_AI_LAB_STARTED,
  mockAiLabProgress,
  provideStoryAiLabCourse,
} from '@testing/mocks/ai-labs.mock';

/**
 * The AI Lab course page, on a stand-in `AiLabCourseFacade` (`provideStoryAiLabCourse`), so each
 * story is one state of the page without HTTP.
 *
 * The stories step through the gates — start → watch → quiz → exam → lab → feedback — because
 * every section below the hero is gated on one of them. The lab has no playable video on any read
 * yet, so the hero frame shows its artwork throughout.
 */
const meta: Meta<AiLabCourse> = {
  title: 'AI Labs/Course page',
  component: AiLabCourse,
  tags: ['autodocs'],
  // `app-backward` resolves its fallback through the router.
  decorators: [applicationConfig({ providers: [provideRouter([])] })],
  render: () => ({ template: `<app-ai-lab-course courseId="${MOCK_AI_LAB_DETAIL.id}" />` }),
};

export default meta;
type Story = StoryObj<AiLabCourse>;

const withState = (state: AiLabCourseStoryState): Story => ({
  decorators: [moduleMetadata({ providers: [provideStoryAiLabCourse(state)] })],
});

const lab = MOCK_AI_LAB_DETAIL;
const practical = {
  brief: MOCK_AI_LAB_BRIEF,
  agents: MOCK_AI_LAB_AGENTS,
  flows: MOCK_AI_LAB_FLOWS,
  balance: MOCK_AI_LAB_BALANCE,
};

/** No enrolment yet: the CTA starts the lab and the hint says what starting opens. */
export const NotStarted = withState({
  lab,
  started: MOCK_AI_LAB_NOT_STARTED,
  ctaStage: 'START',
  brief: MOCK_AI_LAB_BRIEF,
});

/** The parent masterclass course holds the lab: the CTA is disabled and says why. */
export const Locked = withState({
  lab,
  started: MOCK_AI_LAB_NOT_STARTED,
  ctaStage: 'START',
  lockRemark: 'You have already earned credit for this content through its masterclass course.',
});

/** Started, video half-watched. With no video on the read, the CTA has nothing to play. */
export const Watching = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('video'),
  ctaStage: null,
  brief: MOCK_AI_LAB_BRIEF,
});

/**
 * The quiz open in the video frame, first question answered wrong: the verdict, the right option
 * and each option's explanation, as the masterclass chapter quiz shows them.
 */
export const QuizOpen = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('quiz'),
  ctaStage: 'TAKE_QUIZ',
  brief: MOCK_AI_LAB_BRIEF,
  quiz: { questions: MOCK_AI_LAB_QUIZ, index: 0, grade: MOCK_AI_LAB_QUIZ_GRADE },
});

/** Video done, assessment still to pass — the lab stays shut and says why. */
export const AwaitingExam = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('final_assessment'),
  ctaStage: 'TAKE_EXAM',
  brief: MOCK_AI_LAB_BRIEF,
});

/**
 * Exam passed, lab open, artefacts listed (`next_step: ai_assessment`). Feedback isn't offered:
 * our backend opens it only once the lab is graded, so the CTA points at the lab instead.
 */
export const LabUnlocked = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('ai_assessment'),
  ctaStage: 'AI_LAB',
  ...practical,
});

/** An attempt is with the evaluator: the picker stays visible but nothing can be changed. */
export const Evaluating = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('ai_assessment'),
  ctaStage: 'AI_LAB',
  ...practical,
  assignment: MOCK_AI_LAB_EVALUATING,
});

/** Graded, and the backend won't take another submit: the picker stays locked. Feedback opens. */
export const Evaluated = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('feedback'),
  ctaStage: 'FEEDBACK',
  ...practical,
  assignment: MOCK_AI_LAB_EVALUATED,
});

/** Graded with `can_resubmit`: the picker reopens so the learner can try for a better score. */
export const EvaluatedResubmittable = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('feedback'),
  ctaStage: 'FEEDBACK',
  ...practical,
  assignment: { ...MOCK_AI_LAB_EVALUATED, can_resubmit: true },
});

/** The grade card's link expired and the status is being re-read before it opens. */
export const GradeCardPreparing = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('feedback'),
  ctaStage: 'FEEDBACK',
  ...practical,
  assignment: MOCK_AI_LAB_EVALUATED,
  gradeCardBusy: true,
});

/** Grading failed — the error panel offers a resubmit. */
export const EvaluationFailed = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('ai_assessment'),
  ctaStage: 'AI_LAB',
  ...practical,
  assignment: { ...MOCK_AI_LAB_EVALUATING, assessment_status: 'failed' },
});

/** The lab's practical isn't set up: one line in place of the brief, the rest still live. */
export const BriefUnavailable = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('ai_assessment'),
  ctaStage: 'AI_LAB',
  ...practical,
  brief: null,
  briefUnavailable: "This AI Lab's practical is not set up yet. Our team has been notified.",
});

/** No practical mapped — the lab is shut for a different reason, and says so. */
export const LabNotMapped = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('ai_assessment'),
  ctaStage: 'AI_LAB',
  labMapped: false,
});

export const Loading = withState({ isLoading: true });

export const Errored = withState({ error: true });

import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideRouter } from '@angular/router';
import { AiLabCourse } from './ai-lab-course';
import {
  AiLabCourseStoryState,
  MOCK_AI_LAB_AGENTS,
  MOCK_AI_LAB_ATTEMPTS,
  MOCK_AI_LAB_BALANCE,
  MOCK_AI_LAB_BRIEF,
  MOCK_AI_LAB_BRIEF_FULL,
  MOCK_AI_LAB_DETAIL,
  MOCK_AI_LAB_DETAIL_WITH_TRAILER,
  MOCK_AI_LAB_DETAIL_WITH_VIDEO,
  MOCK_AI_LAB_EMAIL,
  MOCK_AI_LAB_EVALUATED,
  MOCK_AI_LAB_EVALUATING,
  MOCK_AI_LAB_FLOWS,
  MOCK_AI_LAB_HINTS,
  MOCK_AI_LAB_NOT_STARTED,
  MOCK_AI_LAB_STARTED,
  mockAiLabProgress,
  provideStoryAiLabCourse,
} from '@testing/mocks/ai-labs.mock';

/**
 * The AI Lab course page, on a stand-in `AiLabCourseFacade` (`provideStoryAiLabCourse`), so each
 * story is one state of the page without HTTP.
 *
 * The stories step through the gates — start → watch → quiz → exam → lab → feedback — because
 * every section below the hero is gated on one of them. Before the start the frame plays the
 * trailer; once started, the lab video. Stories without either show the lab's artwork.
 *
 * The page is the v3 redesign: a journey sidebar (progress overview + step navigator) beside five
 * numbered steps. Step 04 (Hints) shows only when the lab carries hints — or, once open, a flow
 * chart — so most stories here number four steps.
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
/** The lab video plus three hints — the redesign with every section filled. */
const withHints = { ...MOCK_AI_LAB_DETAIL_WITH_VIDEO, ai_lab_course_hints: MOCK_AI_LAB_HINTS };
const practical = {
  brief: MOCK_AI_LAB_BRIEF,
  agents: MOCK_AI_LAB_AGENTS,
  flows: MOCK_AI_LAB_FLOWS,
  balance: MOCK_AI_LAB_BALANCE,
};

/** No enrolment yet: the trailer plays (free seek, no progress), and the CTA starts the lab. */
export const NotStarted = withState({
  lab: MOCK_AI_LAB_DETAIL_WITH_TRAILER,
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

/** Started, video half-watched: the lab video in CPE mode, and the CTA plays / resumes it. */
export const Watching = withState({
  lab: MOCK_AI_LAB_DETAIL_WITH_VIDEO,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('video'),
  ctaStage: null,
  brief: MOCK_AI_LAB_BRIEF,
});

/**
 * Video watched, quiz next: the CTA reads Take Quiz. The quiz itself opens as a pop-up — see
 * _AI Labs/Quiz dialog_.
 */
export const QuizNext = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('quiz'),
  ctaStage: 'TAKE_QUIZ',
  brief: MOCK_AI_LAB_BRIEF,
});

/** Video done, assessment still to pass — the lab stays shut and says why. */
export const AwaitingExam = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('final_assessment'),
  ctaStage: 'TAKE_EXAM',
  brief: MOCK_AI_LAB_BRIEF,
});

/** The assessment failed: step 01 turns amber and asks for a retake; the lab stays shut. */
export const ExamRetake = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('final_assessment'),
  ctaStage: 'RETAKE_EXAM',
  brief: MOCK_AI_LAB_BRIEF,
});

/**
 * Failed with a wait configured (`final_assessment_status: cool_off`): the CTA is disabled and says
 * when the retake opens; it flips to Retake by itself when the wait ends.
 */
export const ExamCoolOff = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('final_assessment'),
  ctaStage: 'COOL_OFF',
  coolOffEndsAt: new Date(Date.now() + 25 * 60_000).toISOString(),
  brief: MOCK_AI_LAB_BRIEF,
});

/** AI Labs couldn't sign the brief's file links (503 `AI_LABS_STORAGE_UNAVAILABLE`): a Retry line. */
export const BriefRetry = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('ai_assessment'),
  ctaStage: 'AI_LAB',
  ...practical,
  brief: null,
  briefProblem: "AI Labs couldn't prepare the file links. Try again in a moment.",
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

/**
 * Signed in to the lab: under Launch, the account Copilot Studio should show and Copy lab link —
 * Copilot Studio picks its own account, so the page says which one to look for.
 */
export const LabSignedIn = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('ai_assessment'),
  ctaStage: 'AI_LAB',
  ...practical,
  labSignedInAs: MOCK_AI_LAB_EMAIL,
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

/**
 * The full 2026-10-26 brief — requirements, a build guide above Launch AI, a flow chart, the
 * sample card (7.85 / 10) with its PDF — plus three hints off the detail's `ai_lab_course_hints`.
 */
export const RedesignLabOpen = withState({
  lab: withHints,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('ai_assessment'),
  ctaStage: 'AI_LAB',
  ...practical,
  brief: MOCK_AI_LAB_BRIEF_FULL,
});

/** Graded three times of five allowed: the best attempt's card and the history beneath it. */
export const RedesignGradedWithHistory = withState({
  lab: withHints,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('feedback'),
  ctaStage: 'FEEDBACK',
  ...practical,
  assignment: { ...MOCK_AI_LAB_EVALUATED, can_resubmit: true },
  attempts: MOCK_AI_LAB_ATTEMPTS,
});

/** Feedback in, certificate issued: the CTA opens the certificate pop-up. */
export const CertificateReady = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: mockAiLabProgress('done'),
  ctaStage: 'DOWNLOAD',
  ...practical,
  assignment: MOCK_AI_LAB_EVALUATED,
});

/** Feedback in, the PDF still generating (`lab_certificate_url: null`): the CTA waits, disabled. */
export const CertificatePending = withState({
  lab,
  started: MOCK_AI_LAB_STARTED,
  progress: { ...mockAiLabProgress('done'), lab_certificate_url: null },
  ctaStage: 'CERTIFICATE_PENDING',
  ...practical,
  assignment: MOCK_AI_LAB_EVALUATED,
});

export const Loading = withState({ isLoading: true });

export const Errored = withState({ error: true });

import { Route } from '@angular/router';
import { provideGsap } from '@code_with_sachin/ngx-gsap';
import { provideMotion } from '@code_with_sachin/ngx-motion';
import { authGuard } from '../../shared/core/guards/auth/auth-guard';
import { canDeactivateExamGuard } from '../../shared/core/guards/can-deactivate-exam-guard';
import { ChapterFacade } from '../../features/offerings/shared/services/chapter-facade/chapter-facade';
import { FeedbackFacade } from '../../features/offerings/shared/services/feedback-facade/feedback-facade';
import { FinalAssessmentFacade } from '../../features/offerings/shared/services/final-assessment-facade/final-assessment-facade';
import { MicroLearningCourseFacade } from '../../features/offerings/shared/services/micro-learning-course-facade/micro-learning-course-facade';

/**
 * AI Labs is the one page that pulls in GSAP + motion.dev for its landing-page
 * animation. Both `provide*()` calls return `EnvironmentProviders`, which only a
 * route (or bootstrap) injector accepts — a component `providers` array can't
 * take them.
 *
 * The indirection through this file is deliberate and load-bearing for the
 * bundle: keeping the `provideGsap`/`provideMotion` imports here — behind the
 * `loadChildren` boundary — pins gsap/lenis/motion to the ai-labs lazy chunk
 * instead of hoisting them into the shared `features` chunk that every offering
 * and partner page loads. The initial bundle budget (warns at 2MB) has no room
 * for them, so they must stay lazy. They sit on the landing route only; the
 * course page below doesn't animate and must not drag them in.
 *
 * Lenis global smooth-scroll is intentionally NOT initialised (no
 * `ScrollService.init()`): the app already owns router scroll restoration and
 * `scroll-mt-20` anchors, and a global scroll hijack would fight both.
 */
export const AI_LABS_ROUTES: Route[] = [
  {
    path: '',
    // `reducedMotion: 'user'` — honour the OS setting; the directives then jump
    // to their final state instead of animating.
    providers: [provideGsap(), provideMotion({ reducedMotion: 'user' })],
    loadComponent: () => import('./ai-labs').then((m) => m.AiLabs),
  },
  /**
   * The course a catalogue card opens. An AI Lab course is a nano-learning row
   * that reports `course_type: 'ai_lab'`, so the whole subtree mirrors
   * micro-learning's (`micro-learning.ts`) — same facades, same exam/report/
   * feedback pages — and only the URL segment differs. Keeping the exam here
   * rather than reusing `/micro-learning/...` is what keeps the learner inside
   * AI Labs for the whole flow.
   */
  {
    path: ':courseId/:courseTitle',
    children: [
      {
        // `ChapterFacade` is route-scoped so the `ChapterQuiz` component
        // (opened via `MicroLearningQuizDialog`) can resolve it via `inject()`.
        providers: [MicroLearningCourseFacade, ChapterFacade],
        path: '',
        loadComponent: () => import('./course/ai-lab-course').then((m) => m.AiLabCourse),
      },
      {
        path: 'final-assessment/:sessionId/exam',
        canActivate: [authGuard],
        providers: [FinalAssessmentFacade],
        canDeactivate: [canDeactivateExamGuard],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../../features/offerings/shared/pages/final-assessment-exam/final-assessment-exam').then(
            (m) => m.FinalAssessmentExam,
          ),
      },
      {
        path: 'final-assessment/:sessionId/report',
        canActivate: [authGuard],
        providers: [FinalAssessmentFacade],
        data: { layout: 'plain' },
        loadComponent: () =>
          import('../../features/offerings/shared/pages/final-assessment-report/final-assessment-report').then(
            (m) => m.FinalAssessmentReport,
          ),
      },
      {
        path: 'feedback',
        canActivate: [authGuard],
        providers: [FeedbackFacade],
        loadComponent: () =>
          import('../../features/offerings/shared/pages/course-feedback/course-feedback').then(
            (m) => m.CourseFeedback,
          ),
      },
    ],
  },
];

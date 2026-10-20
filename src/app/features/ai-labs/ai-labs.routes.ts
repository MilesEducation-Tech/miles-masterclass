import { Route } from '@angular/router';
import { provideGsap } from '@code_with_sachin/ngx-gsap';
import { provideMotion } from '@code_with_sachin/ngx-motion';
import { authGuard } from '@core/guards/auth/auth-guard';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { AiLabAssessmentFacade } from '@features/ai-labs/services/ai-lab-assessment-facade';
import { AiLabFeedbackFacade } from '@features/ai-labs/services/ai-lab-feedback-facade';
import { AiLabCourseFacade } from '@features/ai-labs/services/ai-lab-course-facade';
import { AiLabCredits } from '@features/ai-labs/services/ai-lab-credits';
import { AiLabQuizFacade } from '@features/ai-labs/services/ai-lab-quiz-facade';
import { AiLabsFacade } from '@features/ai-labs/services/ai-labs-facade';

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
 * for them, so they must stay lazy.
 *
 * Lenis global smooth-scroll is intentionally NOT initialised (no
 * `ScrollService.init()`): the app already owns router scroll restoration and
 * `scroll-mt-20` anchors, and a global scroll hijack would fight both.
 */
export const AI_LABS_ROUTES: Route[] = [
  {
    path: '',
    // `reducedMotion: 'user'` — honour the OS setting; the directives then jump
    // to their final state instead of animating. `AiLabsFacade` is route-scoped so
    // its provisioning poll stops when the learner leaves the page.
    providers: [
      provideGsap(),
      provideMotion({ reducedMotion: 'user' }),
      AiLabsFacade,
      AiLabCredits,
    ],
    loadComponent: () => import('./pages/ai-labs/ai-labs').then((m) => m.AiLabs),
  },
  /**
   * The course a catalogue card opens.
   *
   * Deliberately OUTSIDE the `providers` above: `provideGsap()` / `provideMotion()` are what pin
   * gsap, lenis and motion to the landing route's chunk, and the course page does not animate.
   * Nesting it under them would drag all three into its chunk for nothing.
   *
   * Behind `authGuard`: every read on this page is `IsAuthenticated`, so a guest would get a page
   * of 401s. `CanMatch`, so the chunk isn't even downloaded for them. `AiLabCourseFacade` is
   * route-scoped; the page hands it `:courseId` through `withComponentInputBinding()`.
   *
   * The quiz opens in this page's video frame; the exam and the feedback have their own routes
   * below.
   */
  {
    path: ':courseId/:courseTitle',
    canMatch: [authGuard],
    providers: [AiLabCourseFacade, AiLabQuizFacade, AiLabCredits],
    loadComponent: () => import('./pages/ai-lab-course/ai-lab-course').then((m) => m.AiLabCourse),
  },
  /**
   * The lab's final assessment, on the plain layout like the masterclass exam. Leaving with an
   * unsubmitted paper asks first (`canDeactivateExamGuard`). A sibling of the lab page rather than
   * a child, so the lab page's chunk and facades aren't loaded underneath it.
   */
  {
    path: ':courseId/:courseTitle/final-assessment',
    canMatch: [authGuard],
    canDeactivate: [canDeactivateExamGuard],
    providers: [AiLabAssessmentFacade],
    data: { layout: 'plain' },
    loadComponent: () => import('./pages/ai-lab-exam/ai-lab-exam').then((m) => m.AiLabExam),
  },
  /**
   * The lab's feedback, which closes it. Open only once the AI practical is graded — the page reads
   * the gate and says so otherwise.
   */
  {
    path: ':courseId/:courseTitle/feedback',
    canMatch: [authGuard],
    providers: [AiLabFeedbackFacade],
    loadComponent: () =>
      import('./pages/ai-lab-feedback/ai-lab-feedback').then((m) => m.AiLabFeedback),
  },
];

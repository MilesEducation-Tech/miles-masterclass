import { Route } from '@angular/router';
import { provideGsap } from '@code_with_sachin/ngx-gsap';
import { provideMotion } from '@code_with_sachin/ngx-motion';

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
    // to their final state instead of animating.
    providers: [provideGsap(), provideMotion({ reducedMotion: 'user' })],
    loadComponent: () => import('./pages/ai-labs/ai-labs').then((m) => m.AiLabs),
  },
];

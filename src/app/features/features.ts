import { Route } from '@angular/router';
import { DynamicLayout } from '@layout/dynamic-layout/dynamic-layout';
import { uaeCairaMatchGuard } from '@core/guards/uae-caira-match.guard';
import { UaeCairaFacade } from '@features/uae-caira/services/uae-caira-facade';
import { Tracks } from '@features/shared/services/tracks/tracks';
import { Faq } from '@shared/components/faq/faq';
import { TermsOfService } from '@features/legal/pages/terms-of-service/terms-of-service';
import { PrivacyPolicy } from '@features/legal/pages/privacy-policy/privacy-policy';
import { MasterclassFacade } from '@features/offerings/shared/services/masterclass-facade/masterclass-facade';
import { Compliance } from '@features/legal/pages/compliance/compliance';

export const featuresRoutes: Route[] = [
  {
    path: '',
    component: DynamicLayout,
    // FeatureFacade is `providedIn: 'root'` and MUST stay a single app-wide
    // instance: root-level services (e.g. Utils) inject it to broadcast
    // bookmark/profile changes via `applyBookmarkChange`/`refreshPersonalized`
    // to the very resources the offering pages render. Re-providing it here
    // would fork a route-scoped copy that those broadcasts never reach.
    providers: [Tracks],
    children: [
      {
        // ponytail: was `auth.isLoggedIn() ? 'masterclass' : 'home'`. With no
        // session layer everyone lands on the marketing home.
        path: '',
        pathMatch: 'full',
        redirectTo: 'home',
      },
      // UAE CAIRA marketing landing page — handles `home` only for the country
      // segments in `uaeCairaMatchGuard` (currently `ae`). When the guard
      // declines, routing falls through to the default `Home` below. Both
      // routes stay lazy-loaded; `Tracks` (above) is inherited by the levels
      // section. `UaeCairaFacade` powers the CAIRA Levels 1/2/3 carousels.
      {
        path: 'home',
        canMatch: [uaeCairaMatchGuard],
        providers: [UaeCairaFacade],
        loadComponent: () =>
          import('@features/uae-caira/pages/uae-caira/uae-caira').then((m) => m.UaeCaira),
      },
      {
        path: 'home',
        loadComponent: () => import('@features/home/home').then((m) => m.Home),
      },
      {
        path: 'library',
        loadChildren: () => import('@features/library/library').then((m) => m.LibraryRoutes),
      },
      {
        path: 'cpe-tracker',
        loadChildren: () =>
          import('@features/cpe-tracker/cpe-tracker.routes').then((m) => m.CpeTrackerRoutes),
      },
      {
        path: 'caira-tracker',
        loadChildren: () =>
          import('@features/caira-tracker/caira-tracker.routes').then((m) => m.CairaTrackerRoutes),
      },
      { path: 'faq', component: Faq },
      { path: 'terms-of-service', component: TermsOfService },
      { path: 'privacy-policy', component: PrivacyPolicy },
      // Mobile-webview variants — same components, plain layout (no header/
      // footer) for embedding inside the Flutter native app's WebView.
      {
        path: 'mobile',
        data: { layout: 'plain' },
        children: [
          { path: 'faq', component: Faq },
          {
            path: 'terms-of-service',
            component: TermsOfService,
          },
          {
            path: 'privacy-policy',
            component: PrivacyPolicy,
          },
          { path: 'compliance', component: Compliance },
        ],
      },

      {
        path: 'payment',
        loadChildren: () =>
          import('@features/payment/payment.routes').then((m) => m.PAYMENT_ROUTES),
      },
      {
        path: 'instructor/:instructorId/:instructorName',
        loadComponent: () =>
          import('../pages/instructor-details/instructor-details').then((m) => m.InstructorDetails),
      },
      {
        path: 'connect-us',
        loadComponent: () =>
          import('@features/connect-us/pages/connect-us/connect-us').then((m) => m.ConnectUs),
      },
      {
        path: 'how-to-claim-credly-badge',
        loadComponent: () =>
          import('../pages/how-to-claim-credly-badge/how-to-claim-credly-badge').then(
            (m) => m.HowToClaimCredlyBadge,
          ),
      },

      // Legacy `premiere` → `webinar` redirects (dev + in-app navigation; the
      // server handles production SSR). Uses FUNCTIONAL `redirectTo` with
      // concrete param values: Angular's static `redirectTo: 'webinar/:courseId/...'`
      // does NOT reliably substitute `:params`, so it sent users to a literal
      // `/webinar/:courseId/...` and broke the page. Ordered before the `''` lazy
      // children. `:courseTitle` is display-only, so id-only links get a
      // `webinar` placeholder title (matches the server-side behaviour).
      { path: 'premiere', pathMatch: 'full', redirectTo: 'webinar' },
      {
        path: 'premiere/:courseId/expert/:instructorName',
        pathMatch: 'full',
        redirectTo: (r) => `instructor/${r.params['courseId']}/${r.params['instructorName']}`,
      },
      {
        path: 'premiere/:courseId/feedback/:feedbackType',
        pathMatch: 'full',
        redirectTo: (r) => `webinar/${r.params['courseId']}/webinar/feedback`,
      },
      {
        path: 'premiere/:courseId/:courseTitle',
        pathMatch: 'full',
        redirectTo: (r) => `webinar/${r.params['courseId']}/${r.params['courseTitle']}`,
      },
      {
        path: 'premiere/:courseId',
        pathMatch: 'full',
        redirectTo: (r) => `webinar/${r.params['courseId']}/webinar`,
      },

      {
        path: 'faculty',
        loadComponent: () => import('../pages/faculty/faculty').then((m) => m.Faculty),
      },
      {
        // loadChildren (not loadComponent) so the route's gsap/motion providers
        // live behind the lazy boundary — see ai-labs.routes.ts for why.
        path: 'ai-labs',
        loadChildren: () => import('../pages/ai-labs/ai-labs.routes').then((m) => m.AI_LABS_ROUTES),
      },
      // Simulations require a logged-in user: anonymous visitors are sent to
      // /auth/login?redirect=<url> and land back here after OTP verify.
      {
        path: 'simulation',
        loadComponent: () => import('../pages/milesverse/milesverse').then((m) => m.Milesverse),
      },
      {
        path: 'simulation/subjects/:slug',
        loadComponent: () =>
          import('../pages/milesverse/subject/subject').then((m) => m.MilesverseSubject),
      },
      {
        path: 'simulation/briefing/:id',
        loadComponent: () =>
          import('../pages/milesverse/briefing/briefing').then((m) => m.MilesverseBriefing),
      },
      {
        path: 'simulation/report',
        loadComponent: () =>
          import('../pages/milesverse/report/report').then((m) => m.MilesverseReport),
      },
      {
        path: '',
        loadChildren: () =>
          import('@features/partners/partner.routes').then((m) => m.PARTNER_ROUTES),
      },
      {
        path: '',
        providers: [MasterclassFacade],
        loadChildren: () => import('@features/offerings/offerings').then((m) => m.offeringsRoutes),
      },
    ],
  },
];

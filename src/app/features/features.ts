import { Route } from '@angular/router';
import { DynamicLayout } from '../pages/dynamic-layout/dynamic-layout';
import { inject } from '@angular/core';
import { Auth } from '../shared/core/services/auth/auth';
import { guestGuard } from '../shared/core/guards/guest/guest-guard';
import { uaeCairaMatchGuard } from '../shared/core/guards/uae-caira-match.guard';
import { WebinarFacade } from './offerings/webinar/shared/services/webinar-facade/webinar-facade';
import { UaeCairaFacade } from '../pages/uae-caira/shared/services/uae-caira-facade/uae-caira-facade';
import { Tracks } from './shared/services/tracks/tracks';
import { Faq } from '../pages/faq/faq';
import { TermsOfService } from '../pages/terms-of-service/terms-of-service';
import { PrivacyPolicy } from '../pages/privacy-policy/privacy-policy';
import { MasterclassFacade } from './offerings/shared/services/masterclass-facade/masterclass-facade';
import { Compliance } from '../pages/compliance/compliance';

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
        path: '',
        pathMatch: 'full',
        redirectTo: () => {
          const auth = inject(Auth);
          return auth.isLoggedIn() ? 'masterclass' : 'home';
        },
      },
      // UAE CAIRA marketing landing page — handles `home` only for the country
      // segments in `uaeCairaMatchGuard` (currently `ae`). When the guard
      // declines, routing falls through to the default `Home` below. Both
      // routes stay lazy-loaded; `Tracks` (above) is inherited by the levels
      // section. `WebinarFacade` powers the live-webinar registration block and
      // `UaeCairaFacade` powers the CAIRA Levels 1/2/3 carousels.
      {
        path: 'home',
        canMatch: [uaeCairaMatchGuard],
        providers: [WebinarFacade, UaeCairaFacade],
        loadComponent: () => import('../pages/uae-caira/uae-caira').then((m) => m.UaeCaira),
      },
      {
        path: 'home',
        canActivate: [guestGuard],
        loadComponent: () => import('./home/home').then((m) => m.Home),
      },
      {
        path: 'library',
        loadChildren: () => import('./library/library').then((m) => m.LibraryRoutes),
      },
      {
        path: 'cpe-tracker',
        loadChildren: () =>
          import('./cpe-tracker/cpe-tracker.routes').then((m) => m.CpeTrackerRoutes),
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
        loadChildren: () => import('./payment/payment.routes').then((m) => m.PAYMENT_ROUTES),
      },
      {
        path: 'instructor/:instructorId/:instructorName',
        loadComponent: () =>
          import('../pages/instructor-details/instructor-details').then((m) => m.InstructorDetails),
      },
      {
        path: 'connect-us',
        loadComponent: () => import('../pages/connect-us/connect-us').then((m) => m.ConnectUs),
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
        path: 'ai-labs',
        loadComponent: () => import('../pages/ai-labs/ai-labs').then((m) => m.AiLabs),
      },
      {
        path: '',
        loadChildren: () => import('./partners/partner.routes').then((m) => m.PARTNER_ROUTES),
      },
      {
        path: '',
        providers: [MasterclassFacade],
        loadChildren: () => import('./offerings/offerings').then((m) => m.offeringsRoutes),
      },
    ],
  },
];

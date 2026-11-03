import { Route } from '@angular/router';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { authGuard } from '@core/guards/auth/auth-guard';
import { guestGuard } from '@core/guards/auth/guest-guard';
import { featureTranslations } from '@core/services/translation-loader/translation-loader';
import { Auth } from '@features/auth/auth';
import { AuthFacade } from '@features/auth/services/auth-facade';
import en from '../../../i18n/auth/en.json';

export const authRoutes: Route[] = [
  {
    path: '',
    component: Auth,
    // The auth dictionary, merged under `auth.*` before the shell or any page renders.
    resolve: {
      i18n: featureTranslations('auth', en, {
        ar: () => import('../../../i18n/auth/ar.json'),
        fr: () => import('../../../i18n/auth/fr.json'),
        de: () => import('../../../i18n/auth/de.json'),
        es: () => import('../../../i18n/auth/es.json'),
      }),
    },
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        canMatch: [guestGuard],
        // A route's injector outlives the page, so `Login` resets the facade itself when it is
        // destroyed.
        providers: [AuthFacade],
        loadComponent: () => import('@features/auth/pages/login/login').then((m) => m.Login),
      },
      {
        // The login card with sign-up copy, code-only: the API creates an account when a code is
        // verified and has no register-with-password route. Its own providers, so its own facade:
        // a half-finished sign-in can't carry over.
        path: 'signup',
        canMatch: [guestGuard],
        providers: [AuthFacade],
        data: { signup: true },
        loadComponent: () => import('@features/auth/pages/login/login').then((m) => m.Login),
      },
      {
        path: 'forgot-password',
        canMatch: [guestGuard],
        loadComponent: () =>
          import('@features/auth/pages/forgot-password/forgot-password').then(
            (m) => m.ForgotPassword,
          ),
      },
      {
        // Where the set/reset email links (contract §2.9). No guard: the link works signed in or out.
        path: 'password/reset',
        loadComponent: () =>
          import('@features/auth/pages/reset-password/reset-password').then((m) => m.ResetPassword),
      },
      {
        path: 'profile',
        canMatch: [authGuard],
        canDeactivate: [canDeactivateExamGuard],
        loadComponent: () => import('@features/auth/pages/profile/profile').then((m) => m.Profile),
      },
    ],
  },
];

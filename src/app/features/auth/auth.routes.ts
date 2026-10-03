import { Route } from '@angular/router';
import { AuthFacade } from './services/auth-facade';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { authGuard } from '@core/guards/auth/auth-guard';
import { guestGuard } from '@core/guards/auth/guest-guard';
import { featureTranslations } from '@core/services/translation-loader/translation-loader';
import { Auth } from './auth';
import en from '../../../i18n/auth/en.json';

export const authRoutes: Route[] = [
  {
    path: '',
    component: Auth,
    providers: [AuthFacade], // Scoped to auth routes - destroyed when leaving
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
        loadComponent: () => import('./pages/login/login').then((m) => m.Login),
      },
      // `signup` and `forget-password` are gone. Sign-in is OTP-only, so there
      // is no password to forget, and `auth-identify/` answers identically for
      // a known and an unknown identifier — login IS signup. Old links are
      // redirected server-side in `src/legacy-redirects.ts`.
      {
        path: 'profile',
        canMatch: [authGuard],
        canDeactivate: [canDeactivateExamGuard],
        loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
      },
    ],
  },
];

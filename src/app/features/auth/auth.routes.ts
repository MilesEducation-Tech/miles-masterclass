import { Route } from '@angular/router';
import { AuthFacade } from './services/auth-facade';
import { canDeactivateExamGuard } from '@core/guards/can-deactivate-exam-guard';
import { authGuard } from '@core/guards/auth/auth-guard';
import { guestGuard } from '@core/guards/auth/guest-guard';
import { Auth } from './auth';

export const authRoutes: Route[] = [
  {
    path: '',
    component: Auth,
    providers: [AuthFacade], // Scoped to auth routes - destroyed when leaving
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

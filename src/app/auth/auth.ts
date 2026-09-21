import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Route, Router, RouterOutlet } from '@angular/router';
import { AuthFacade } from './shared/services/auth-facade';
import { environment } from '../../environments/environment';
import { NgIcon } from '@ng-icons/core';
import { svglGoogle, svglAppleDark } from '@ng-icons/svgl';
import { faSolidAngleLeft } from '@ng-icons/font-awesome/solid';
import { logo } from '../shared/core/constant/icon';
import { canDeactivateExamGuard } from '../shared/core/guards/can-deactivate-exam-guard';

/**
 * ponytail: design-only shell. The session service, the logout confirmation
 * dialog and the guest guards were removed with the auth layer, so the back
 * button is always "Back to Home" and never offers logout.
 */
@Component({
  selector: 'app-auth',
  imports: [RouterOutlet, NgOptimizedImage, NgIcon],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  S3_BUCKET_URL = environment.S3_BUCKET_URL;

  icons = signal({
    logo: logo,
    google: svglGoogle,
    apple: svglAppleDark,
    faSolidAngleLeft,
  });

  protected readonly buttonLabel = signal('Back to Home');

  protected handleBackOrLogout(): void {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    this.router.navigateByUrl(redirect || '/');
  }
}

export const authRoutes: Route[] = [
  {
    path: '',
    component: Auth,
    providers: [AuthFacade], // Scoped to auth routes - destroyed when leaving
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        loadComponent: () => import('./shared/pages/login/login').then((m) => m.Login),
      },
      {
        path: 'signup',
        loadComponent: () => import('./shared/pages/signup/signup').then((m) => m.Signup),
      },
      {
        path: 'forget-password',
        loadComponent: () =>
          import('./shared/pages/forget-password/forget-password').then((m) => m.ForgetPassword),
      },
      {
        path: 'profile',
        canDeactivate: [canDeactivateExamGuard],
        loadComponent: () => import('./shared/pages/profile/profile').then((m) => m.Profile),
      },
    ],
  },
];

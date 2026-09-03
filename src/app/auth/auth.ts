import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Route, Router, RouterOutlet } from '@angular/router';
import { AuthFacade } from './shared/services/auth-facade';
import { environment } from '../../environments/environment';
import { NgIcon } from '@ng-icons/core';
import { svglGoogle, svglAppleDark } from '@ng-icons/svgl';
import { faSolidAngleLeft } from '@ng-icons/font-awesome/solid';
import { logo } from '../shared/core/constant/icon';
import { guestGuard } from '../shared/core/guards/guest/guest-guard';
import { canDeactivateExamGuard } from '../shared/core/guards/can-deactivate-exam-guard';
import { Auth as AuthService } from '../shared/core/services/auth/auth';
import { Dialog } from '../shared/core/services/dialog/dialog';
import { UtilsDialog, DialogButton } from '../shared/components/dialog/utils-dialog/utils-dialog';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-auth',
  imports: [RouterOutlet, NgOptimizedImage, NgIcon],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(Dialog);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  authFacade = inject(AuthFacade);

  auth_type = this.authFacade.auth_type;

  S3_BUCKET_URL = environment.S3_BUCKET_URL;

  icons = signal({
    logo: logo,
    google: svglGoogle,
    apple: svglAppleDark,
    faSolidAngleLeft,
  });

  protected readonly showLogout = computed(() => {
    const user = this.authService.currentUser();
    return this.auth_type() === 'profile' && !!user && !user.is_existing_user;
  });

  protected readonly buttonLabel = computed(() => (this.showLogout() ? 'Logout' : 'Back to Home'));

  protected navigateTo() {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    this.router.navigateByUrl(redirect || '/');
  }

  protected async handleBackOrLogout() {
    if (!this.showLogout()) {
      this.navigateTo();
      return;
    }

    const dialogRef = this.dialog.open<
      UtilsDialog,
      { action?: DialogButton['action']; result: boolean }
    >(UtilsDialog, {
      data: {
        title: 'Logout',
        content: [{ type: 'text', value: 'Are you sure you want to logout?' }],
        buttons: [
          { label: 'Cancel', variant: 'outline', action: 'close' },
          { label: 'Logout', variant: 'destructive', action: 'confirm' },
        ],
      },
    });

    const result = await firstValueFrom(dialogRef.afterClosed$);
    if (result?.action === 'confirm') {
      this.authService.clearAuth();
      // After logout from an auth page (e.g. the profile completion step
      // shown to non-existing users), land on the home page rather than
      // bouncing back to `/auth/login` — there's nothing meaningful for a
      // freshly-logged-out user to do on the login screen.
      //
      // We force a hard navigation (`window.location.assign`) instead of
      // `router.navigateByUrl` because the profile route's
      // `canDeactivate` guard will block the SPA navigation when the form
      // is dirty (auto-populated fields can count as dirty), trapping the
      // user on a logged-out auth page. The full reload also flushes any
      // stale in-memory state from the previous session.
      if (this.isBrowser) {
        window.location.assign('/');
      } else {
        await this.router.navigateByUrl('/');
      }
    }
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
        canActivate: [guestGuard],
        loadComponent: () => import('./shared/pages/login/login').then((m) => m.Login),
      },
      {
        path: 'signup',
        canActivate: [guestGuard],
        loadComponent: () => import('./shared/pages/signup/signup').then((m) => m.Signup),
      },
      {
        path: 'forget-password',
        canActivate: [guestGuard],
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

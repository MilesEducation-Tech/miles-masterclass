import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Router, RouterOutlet, UrlTree } from '@angular/router';
import { environment } from '@env/environment';
import { NgIcon } from '@ng-icons/core';
import { svglGoogle, svglAppleDark } from '@ng-icons/svgl';
import { faSolidAngleLeft } from '@ng-icons/font-awesome/solid';
import { logo } from '@core/constants/icon';

/**
 * ponytail: design-only shell. The session service, the logout confirmation
 * dialog and the guest guards were removed with the auth layer, so the back
 * button never offers logout. It returns to the page sign-in was asked from,
 * or home (see `handleBackOrLogout`).
 */
@Component({
  selector: 'app-auth',
  imports: [RouterOutlet, NgOptimizedImage, NgIcon, TranslocoPipe],
  templateUrl: './auth.html',
})
export class Auth {
  private readonly router = inject(Router);

  S3_BUCKET_URL = environment.ASSETS.s3Url;

  icons = signal({
    logo: logo,
    google: svglGoogle,
    apple: svglAppleDark,
    faSolidAngleLeft,
  });

  /**
   * The page the visitor was on when sign-in was asked for, or `null` when
   * they landed on sign-in directly (a link from an email, a typed URL).
   *
   * For example, the course page whose "Watch Now" hit a guarded chapter, or
   * the webinar page whose Join asked them to sign in. Read once, while the
   * navigation into `/auth` is still in flight: its `previousNavigation` is the
   * last page that actually rendered. The sign-in steps don't change the URL,
   * so this stays right for as long as the shell is open.
   */
  private readonly backUrl: UrlTree | null =
    this.router.currentNavigation()?.previousNavigation?.finalUrl ?? null;

  /**
   * Back to the page sign-in was asked from, else home. Never `redirect`: that
   * is where a learner goes AFTER signing in, and it is usually a page
   * `authGuard` protects, so sending a visitor there only bounced them
   * straight back to this page and the button looked dead.
   */
  protected async handleBackOrLogout(): Promise<void> {
    await this.router.navigateByUrl(this.backUrl ?? '/');

    // The page they came from can need a session too, when theirs ran out
    // while they were on it. Its guard has then sent them straight back here,
    // so go home instead.
    if (this.backUrl && this.router.url.startsWith('/auth')) {
      await this.router.navigateByUrl('/');
    }
  }
}

import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { environment } from '@env/environment';
import { NgIcon } from '@ng-icons/core';
import { svglGoogle, svglAppleDark } from '@ng-icons/svgl';
import { faSolidAngleLeft } from '@ng-icons/font-awesome/solid';
import { logo } from '@core/constants/icon';

/**
 * ponytail: design-only shell. The session service, the logout confirmation
 * dialog and the guest guards were removed with the auth layer, so the back
 * button is always "Back to Home" and never offers logout.
 */
@Component({
  selector: 'app-auth',
  imports: [RouterOutlet, NgOptimizedImage, NgIcon, TranslocoPipe],
  templateUrl: './auth.html',
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

  protected handleBackOrLogout(): void {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    this.router.navigateByUrl(redirect || '/');
  }
}

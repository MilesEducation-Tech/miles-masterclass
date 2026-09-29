import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Utils } from '@shared/services/utils';
import { Button } from '../../ui/button/button';
import { logo } from '@core/constants/icon';
import { environment } from '@env/environment';
import { Dialog } from '@shared/ui/dialog/dialog';
import { heroXMark } from '@ng-icons/heroicons/outline';

/**
 * Feature-launch dialog for Miles AI Labs. Surfaced by `EngagementDialog` at
 * first priority; the orchestrator marks it dismissed at open-time, so every
 * exit path ("Explore the Lab", "Maybe Later", the X, backdrop, Escape) is
 * equivalent as far as re-showing goes. Typed `void` for that reason.
 */
@Component({
  selector: 'app-ai-lab-dialog',
  imports: [Button, NgIcon, Dialog],
  providers: [provideIcons({ heroXMark })],
  templateUrl: './ai-lab-dialog.html',
  styleUrl: './ai-lab-dialog.css',
  host: { class: 'block' },
})
export class AiLabDialog {
  protected readonly dialogRef = injectDialogRef<void, void>();

  private readonly router = inject(Router);
  private readonly utils = inject(Utils);

  protected readonly logoSvg = logo;

  /**
   * Base path for the Figma-exported orbit artwork, served from the CDN like
   * every other static image in the app rather than bundled into `public/`.
   */
  protected readonly asset = `${environment.S3_BUCKET_URL}static-assests/web-app/miles-ai-labs`;

  protected readonly labRoute = computed(
    () => `/${this.utils.country()}/${this.utils.profession()}/ai-labs`,
  );

  exploreLab(): void {
    this.router.navigateByUrl(this.labRoute());
    this.dialogRef.close();
  }
}

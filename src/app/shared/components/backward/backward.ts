import { Component, inject, input, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matArrowBackRound } from '@ng-icons/material-icons/round';

@Component({
  selector: 'app-backward',
  imports: [NgIcon],
  template: `
    <button
      type="button"
      class="flex items-center gap-2 text-gray-300 hover:text-white transition-colors cursor-pointer"
      (click)="goBack()"
      [attr.aria-label]="label()"
    >
      <ng-icon name="matArrowBackRound" size="24" aria-hidden="true" />
      <span class="text-sm font-medium">{{ label() }}</span>
    </button>
  `,
  host: { class: 'block' },
  viewProviders: [provideIcons({ matArrowBackRound })],
})
export class Backward {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);

  /** Button label */
  readonly label = input('Back');

  /** Fallback route if no history exists (default: home) */
  readonly fallback = input('/');

  /** Optional explicit route path to navigate to (takes priority over history-based navigation) */
  readonly routePath = input<string | null>(null);

  goBack(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const explicitPath = this.routePath();

    // If an explicit route path is provided, navigate to it directly
    // If an explicit route path is provided, navigate to it directly
    if (explicitPath) {
      this.router.navigate([explicitPath], { relativeTo: this.route });
      return;
    }

    // Check if there's navigation history within the app
    // window.history.length > 1 means there's at least one previous entry
    // But this includes external pages, so we also check document.referrer
    const hasAppHistory =
      window.history.length > 1 && document.referrer.includes(window.location.origin);

    if (hasAppHistory) {
      window.history.back();
    } else {
      // No valid history, navigate to fallback route
      this.router.navigate([this.fallback()]);
    }
  }
}

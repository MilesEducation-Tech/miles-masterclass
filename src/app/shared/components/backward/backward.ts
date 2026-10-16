import { Component, DOCUMENT, inject, input, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, Location } from '@angular/common';
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
      <ng-icon name="matArrowBackRound" size="24" class="rtl:-scale-x-100" aria-hidden="true" />
      <span class="text-sm font-medium">{{ label() }}</span>
    </button>
  `,
  host: { class: 'block' },
  viewProviders: [provideIcons({ matArrowBackRound })],
})
export class Backward {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  /** Button label */
  readonly label = input('Back');

  /** Fallback route when no page of this site opened this one (default: home) */
  readonly fallback = input('/');

  /** Optional explicit route path to navigate to (takes priority over history-based navigation) */
  readonly routePath = input<string | null>(null);

  goBack(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // If an explicit route path is provided, navigate to it directly
    const explicitPath = this.routePath();
    if (explicitPath) {
      this.router.navigate([explicitPath], { relativeTo: this.route });
      return;
    }

    if (this.hasPreviousInAppPage()) {
      this.location.back();
    } else {
      this.router.navigate([this.fallback()]);
    }
  }

  /**
   * Whether the history entry before this one is a page of this site, so Back
   * returns to whatever opened this page.
   *
   * Not `document.referrer`: the browser sets it only on a full page load, so
   * after in-app navigation it is usually empty, and Back fell through to the
   * fallback. The Navigation API lists only this origin's entries, so
   * `canGoBack` is false when the previous page is another site. Where it is
   * missing, any earlier router navigation counts.
   */
  private hasPreviousInAppPage(): boolean {
    const navigation: Navigation | undefined = this.document.defaultView?.navigation;
    return navigation
      ? navigation.canGoBack
      : !!this.router.lastSuccessfulNavigation()?.previousNavigation;
  }
}

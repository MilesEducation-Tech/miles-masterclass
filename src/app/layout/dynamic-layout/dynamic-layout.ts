import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { MainLayout } from '../main-layout/main-layout';
import { PlainLayout } from '../plain-layout/plain-layout';

export type LayoutType = 'main' | 'plain';

@Component({
  selector: 'app-dynamic-layout',
  imports: [MainLayout, PlainLayout],
  template: `
    @switch (layoutType()) {
      @case ('plain') {
        <app-plain-layout />
      }
      @default {
        <app-main-layout />
      }
    }
  `,
})
export class DynamicLayout {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly layoutType = signal<LayoutType>('main');

  constructor() {
    // Listen to navigation events and update layout based on deepest child route data
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null), // Trigger on initial load
        map(() => this.getLayoutFromRoute()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((layout) => {
        this.layoutType.set(layout);
      });
  }

  /**
   * Traverse the route tree to find layout data.
   * Returns 'main' by default if no layout is specified in any route.
   * Layout data is optional - only routes that need a different layout need to specify it.
   *
   * Embed contract: `?embed=mobile` on any route forces `plain` layout
   * (no header/footer). Used by the Flutter webview when a route is
   * displayed inside the native app — Flutter passes the param so the same
   * URL serves both web and native consumers without a parallel route.
   */
  private getLayoutFromRoute(): LayoutType {
    let currentRoute: ActivatedRoute | null = this.route;
    let layout: LayoutType = 'main'; // Default layout

    while (currentRoute) {
      // Check if snapshot exists (may be undefined during SSR)
      const routeLayout = currentRoute.snapshot?.data?.['layout'] as LayoutType | undefined;
      // Only update layout if explicitly defined in route data
      if (routeLayout) {
        layout = routeLayout;
      }
      // ?embed=mobile wins over route-level layout — caller is asking us to
      // strip chrome regardless of the route's normal preference.
      if (currentRoute.snapshot?.queryParamMap.get('embed') === 'mobile') {
        return 'plain';
      }
      currentRoute = currentRoute.firstChild;
    }

    return layout;
  }
}

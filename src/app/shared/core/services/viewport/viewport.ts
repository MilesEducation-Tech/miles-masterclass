import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, PLATFORM_ID, Service, signal } from '@angular/core';

/** Coarse device class derived from viewport width. */
export type ScreenSize = 'mobile' | 'tablet' | 'desktop';

/** Viewport orientation. */
export type ScreenOrientation = 'portrait' | 'landscape';

/** Snapshot of the current screen size + orientation. */
export interface ScreenInfo {
  screen: ScreenSize;
  orientation: ScreenOrientation;
}

/**
 * Breakpoint media queries, aligned to the Tailwind scale this app styles with
 * (`md` = 768px, `lg` = 1024px) so the JS device class always agrees with the
 * `md:` / `lg:` CSS utilities used in templates:
 *   - mobile  : width < 768   (below `md`)
 *   - tablet  : 768 ≤ width < 1024  (`md` … `lg`)
 *   - desktop : width ≥ 1024  (`lg`+)
 */
const TABLET_MIN_QUERY = '(min-width: 768px)';
const DESKTOP_MIN_QUERY = '(min-width: 1024px)';
const PORTRAIT_QUERY = '(orientation: portrait)';

/**
 * Single source of truth for responsive state (screen size + orientation),
 * exposed as signals.
 *
 * Replaces the per-component `window.matchMedia` / `(window:resize)` /
 * `window.innerWidth` observers that were scattered across the app (header,
 * slider, admin layout, section nav) — each with its own breakpoint constant
 * and its own subscription to clean up.
 *
 * Implementation notes:
 *   - Backed by `matchMedia`, whose `change` event fires only when a breakpoint
 *     (or orientation) is actually crossed — far cheaper than a `resize`
 *     listener that fires on every pixel and then re-derives a boolean.
 *   - SSR-safe: on the server (no `matchMedia`) the signals keep their
 *     defaults — `desktop` + `landscape` — so server markup matches the most
 *     common first paint and avoids a mobile→desktop hydration flash on wide
 *     screens. Real values are set synchronously on first browser construction.
 *   - `providedIn: 'root'` so every consumer shares one set of listeners.
 */
@Service()
export class Viewport {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _screen = signal<ScreenSize>('desktop');
  private readonly _orientation = signal<ScreenOrientation>('landscape');

  /** Current screen size: `'mobile'` (<768) | `'tablet'` (768–1023) | `'desktop'` (≥1024). */
  readonly screen = this._screen.asReadonly();

  /** Current viewport orientation: `'portrait'` | `'landscape'`. */
  readonly orientation = this._orientation.asReadonly();

  /** `true` when the screen is in the mobile bucket (<768). */
  readonly isMobile = computed(() => this._screen() === 'mobile');

  /** `true` when the screen is in the tablet bucket (768–1023). */
  readonly isTablet = computed(() => this._screen() === 'tablet');

  /** `true` when the screen is in the desktop bucket (≥1024). */
  readonly isDesktop = computed(() => this._screen() === 'desktop');

  /** `true` below the desktop breakpoint — mobile OR tablet (<1024). */
  readonly isHandheld = computed(() => this._screen() !== 'desktop');

  /** `true` when the viewport is taller than it is wide. */
  readonly isPortrait = computed(() => this._orientation() === 'portrait');

  /** `true` when the viewport is wider than it is tall. */
  readonly isLandscape = computed(() => this._orientation() === 'landscape');

  /** Combined screen size + orientation as a reactive signal. */
  readonly screenInfo = computed<ScreenInfo>(() => ({
    screen: this._screen(),
    orientation: this._orientation(),
  }));

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const view = this.document.defaultView;
    if (!view?.matchMedia) return;

    const tabletMin = view.matchMedia(TABLET_MIN_QUERY);
    const desktopMin = view.matchMedia(DESKTOP_MIN_QUERY);
    const portrait = view.matchMedia(PORTRAIT_QUERY);

    const syncScreen = (): void => {
      this._screen.set(desktopMin.matches ? 'desktop' : tabletMin.matches ? 'tablet' : 'mobile');
    };
    const syncOrientation = (): void => {
      this._orientation.set(portrait.matches ? 'portrait' : 'landscape');
    };

    // Seed from the real viewport before the first change event.
    syncScreen();
    syncOrientation();

    tabletMin.addEventListener('change', syncScreen);
    desktopMin.addEventListener('change', syncScreen);
    portrait.addEventListener('change', syncOrientation);

    this.destroyRef.onDestroy(() => {
      tabletMin.removeEventListener('change', syncScreen);
      desktopMin.removeEventListener('change', syncScreen);
      portrait.removeEventListener('change', syncOrientation);
    });
  }

  /**
   * Imperative snapshot of the current screen size + orientation. Prefer the
   * `screen` / `orientation` signals (or `screenInfo`) inside reactive contexts
   * (templates, `computed`, `effect`); use this for one-off reads in event
   * handlers where reactivity isn't needed.
   */
  getScreenInfo(): ScreenInfo {
    return this.screenInfo();
  }
}

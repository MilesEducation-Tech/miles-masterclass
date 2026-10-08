import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service, signal } from '@angular/core';

/** A request faster than this never shows the bar, so quick and cached calls don't flash it. */
const SHOW_DELAY_MS = 150;

/** Once shown, the bar stays at least this long, so it reads as motion rather than a blink. */
const MIN_VISIBLE_MS = 400;

/**
 * The global loading bar's state: how much work is in flight, and whether the
 * bar is showing. `loadingInterceptor` drives it for every HTTP request that
 * isn't tagged `SKIP_LOADING`. Other async work can use it the same way:
 * `const stop = loading.start(); try { … } finally { stop(); }`.
 *
 * Browser-only. On the server there is no bar to show, and a timer would only
 * outlive the render, so `start()` is a no-op there.
 */
@Service()
export class LoadingService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private active = 0;
  private shownAt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  private readonly _visible = signal(false);
  /** Whether the bar is showing: `SHOW_DELAY_MS` after work starts, `MIN_VISIBLE_MS` at least. */
  readonly visible = this._visible.asReadonly();

  /**
   * Marks one unit of work in flight and returns its stop. Stop is idempotent,
   * so a caller that ends twice (error, then cleanup) can't under-count.
   */
  start(): () => void {
    if (!this.isBrowser) return () => undefined;

    // The first unit schedules the show; this also cancels a pending hide, so
    // back-to-back requests keep one bar instead of blinking between them.
    if (this.active++ === 0) {
      this.schedule(() => {
        this.shownAt = Date.now();
        this._visible.set(true);
      }, SHOW_DELAY_MS);
    }

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      if (--this.active > 0) return;
      // Never shown: cancel the pending show. Shown: hide once the minimum is up.
      const remaining = this._visible() ? MIN_VISIBLE_MS - (Date.now() - this.shownAt) : 0;
      this.schedule(() => this._visible.set(false), remaining);
    };
  }

  /** One timer for both transitions; a new schedule replaces the pending one. */
  private schedule(run: () => void, delayMs: number): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (delayMs > 0) this.timer = setTimeout(run, delayMs);
    else run();
  }
}

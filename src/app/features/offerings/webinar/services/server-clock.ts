import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Service, PLATFORM_ID, signal } from '@angular/core';

/**
 * The webinar module's source of "now", and its one ticker.
 *
 * A page can render thirty cards, each with a countdown. One interval driving
 * one signal, with every countdown a `computed()` off it, is the difference
 * between one timer and thirty. This is the repo's first ticking code — keep it
 * in this one place.
 *
 * ponytail: `now()` is the DEVICE clock. A device ten minutes fast shows Join
 * ten minutes early and then fails the server's own window check. Correcting
 * that needs a server timestamp the Events API does not send; once the feed
 * carries one, capture `server − device` here and add it in `now()`.
 *
 * Provided at the webinar route so it dies with the feature, not at root.
 */
@Service({ autoProvided: false })
export class ServerClock {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Ticks every second while at least one consumer is subscribed. Read this in
   * a `computed()` to make it recompute on the tick.
   */
  readonly tick = signal(0);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private subscribers = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  /** Epoch milliseconds. Read through here so the skew fix lands in one place. */
  now(): number {
    return Date.now();
  }

  /**
   * Start the 1s ticker, reference-counted. Returns a release function; callers
   * should wire it into `destroyRef.onDestroy` so the last card leaving the
   * page also stops the timer.
   *
   * No-ops on the server — an interval during SSR would keep the render alive.
   */
  startTicking(): () => void {
    if (!this.isBrowser) return () => undefined;

    this.subscribers += 1;
    if (this.intervalId === null) {
      this.intervalId = setInterval(() => this.tick.update((n) => n + 1), 1000);
    }

    let released = false;
    return () => {
      // Guard against a double release decrementing the count twice and
      // stopping a ticker other cards still need.
      if (released) return;
      released = true;
      this.subscribers -= 1;
      if (this.subscribers <= 0) this.stop();
    };
  }

  private stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.subscribers = 0;
  }
}

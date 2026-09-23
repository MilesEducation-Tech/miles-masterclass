import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Service, PLATFORM_ID, signal } from '@angular/core';
import { parseIso } from '../utils/session-time';

/**
 * The webinar module's source of "now".
 *
 * Every countdown and the join-window gate read from here rather than calling
 * `Date.now()` directly. Two reasons:
 *
 * 1. **Clock skew.** A device whose clock is ten minutes fast would show the
 *    Join button ten minutes early and then fail the server's own window check.
 *    The feed carries `server_time`; we capture the offset once per load and
 *    derive everything from it.
 * 2. **One ticker.** A page can render thirty cards, each with a countdown. One
 *    interval driving one signal, with every countdown a `computed()` off it,
 *    is the difference between one timer and thirty. This is the repo's first
 *    ticking code — keep it in this one place.
 *
 * Provided at the webinar route so it dies with the feature, not at root.
 */
@Service({ autoProvided: false })
export class ServerClock {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  /**
   * `serverTime − deviceTime`, in ms. Zero until a feed response supplies
   * `server_time`, which is the correct fallback: trusting the device is
   * strictly better than refusing to render a countdown at all.
   */
  private offsetMs = 0;

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

  /**
   * Adopt the server's clock. Called once per feed load; a response without
   * `server_time` is ignored rather than resetting a good offset to zero.
   */
  syncFrom(serverTime: string | null | undefined): void {
    const parsed = parseIso(serverTime);
    if (parsed === null) return;
    this.offsetMs = parsed - Date.now();
  }

  /** Server-aligned epoch milliseconds. */
  now(): number {
    return Date.now() + this.offsetMs;
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

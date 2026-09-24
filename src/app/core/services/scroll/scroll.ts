import { DOCUMENT, Service, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ScrollToOptions {
  /** Pixels to subtract from the target's top — useful for clearing fixed headers. */
  offset?: number;
  /** `'smooth'` (default) or `'instant'`/`'auto'`. */
  behavior?: ScrollBehavior;
}

/**
 * Smooth-scroll helper. SSR-safe — every method is a no-op on the server.
 */
@Service()
export class ScrollService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  scrollToId(id: string, options: ScrollToOptions = {}): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const target = this.document.getElementById(id);
    if (target) this.scrollToElement(target, options);
  }

  scrollToElement(element: HTMLElement, options: ScrollToOptions = {}): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const { offset = 0, behavior = 'smooth' } = options;
    const win = this.document.defaultView;
    // if (!win) return;

    const targetTop = () => element.getBoundingClientRect().top + win?.scrollY! - offset;

    // Content above the target keeps shifting *after* the click — `@defer (on
    // viewport)` blocks that only load as the scroll reaches them, lazy images
    // with no reserved size. The shift often lands *after* a network gap, which
    // is why the first (cold) visit ends up in the footer but the second
    // (cached) visit works. targetTop() is the target's absolute document
    // position, so it holds steady while a smooth scroll animates and only moves
    // on a real layout shift. Re-correct on every shift for the whole settle
    // window — no "went quiet, we're done" guess, since a slow chunk can pause
    // longer than any quiet window and shift afterwards. Bail the moment the
    // user actually scrolls (their intent wins); hard-cap otherwise.
    // ponytail: 3s cap covers slow content; raise only if real loads exceed it.
    win?.scrollTo({ top: targetTop(), behavior });

    let lastTop = targetTop();
    let frames = 0;
    let cancelled = false;
    // Real scroll intent — NOT the 'scroll' event, which our own scrollTo fires.
    const events = ['wheel', 'touchstart', 'keydown'] as const;
    const cleanup = () => events.forEach((e) => win?.removeEventListener(e, userTookOver));
    const userTookOver = () => {
      cancelled = true;
      cleanup();
    };
    events.forEach((e) => win?.addEventListener(e, userTookOver, { passive: true }));

    const tick = () => {
      if (cancelled) return;
      const top = targetTop();
      if (Math.abs(top - lastTop) >= 1) {
        lastTop = top;
        win?.scrollTo({ top, behavior });
      }
      if (frames++ >= 180) {
        cleanup();
        return;
      }
      win?.requestAnimationFrame(tick);
    };
    win?.requestAnimationFrame(tick);
  }

  scrollToTop(options: ScrollToOptions = {}): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const { behavior = 'smooth' } = options;
    this.document.defaultView?.scrollTo({ top: 0, behavior });
  }
}

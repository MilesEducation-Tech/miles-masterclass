import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { VideoPoster } from '../../../../../shared/components/video-poster/video-poster';

export type VideoListSide = 'left' | 'right' | 'top' | 'bottom';

export interface VideoListItem {
  videoSrc: string;
  posterSrc: string;
  /** Optional portrait-friendly video used at `<md` widths. Falls back to
   * `videoSrc` when omitted. */
  mobileVideoSrc?: string;
  /** Optional portrait-friendly poster used at `<md` widths. Falls back to
   * `posterSrc` when omitted. */
  mobilePosterSrc?: string;
}

@Component({
  selector: 'app-video-list-wrapper',
  imports: [VideoPoster, NgOptimizedImage],
  templateUrl: './video-list-wrapper.html',
  styleUrl: './video-list-wrapper.css',
})
export class VideoListWrapper {
  readonly videoList = input<VideoListItem[]>([]);
  /**
   * When set, renders a gradient-backdrop overlay on the given side of the
   * video. Projected content (`<ng-content>`) is placed inside the overlay.
   * Interactive children need `pointer-events-auto` since the overlay itself
   * is `pointer-events-none` so video controls remain clickable.
   */
  readonly side = input<VideoListSide | null>(null);

  readonly activeVideoIndex = signal<number>(0);
  readonly activeVideo = linkedSignal<VideoListItem>(
    () => this.videoList()[this.activeVideoIndex()],
  );

  protected readonly hasMobileVideo = computed(() => !!this.activeVideo()?.mobileVideoSrc);

  // Mobile mirrors the home-hero pattern: the video fills the (aspect-9/16)
  // container and the overlay hugs the bottom with a bottom-up gradient so
  // projected text reads cleanly over the video. Desktop reverts to the
  // side-based split.
  protected readonly overlayClasses = computed(() => {
    const s = this.side();
    if (!s) return '';
    const common = 'absolute z-20 from-background to-transparent flex pointer-events-none pb-10';
    const mobile = 'inset-x-0 bottom-0 h-2/3 bg-linear-to-t';
    const desktopMap: Record<VideoListSide, string> = {
      left: 'md:inset-y-0 md:left-0 md:right-auto md:bottom-auto md:w-1/2 md:h-full md:bg-linear-to-r md:from-30% md:via-background/60 md:via-60%',
      right:
        'md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:w-1/2 md:h-full md:bg-linear-to-l md:from-30% md:via-background/60 md:via-60%',
      top: 'md:inset-x-0 md:top-0 md:bottom-auto md:h-1/2 md:w-full md:bg-linear-to-b',
      bottom: 'md:inset-x-0 md:bottom-0 md:top-auto md:h-1/2 md:w-full md:bg-linear-to-t',
    };
    return `${common} ${mobile} ${desktopMap[s]}`;
  });

  // Video always fills the container (mobile + desktop). The overlay sits on
  // top and uses its gradient to fade the side the projected content occupies.
  protected readonly videoWrapperClasses = computed(() => 'absolute inset-0 z-0 flex');

  // Hero mode (side set): containerised on mobile so the player doesn't span
  // edge-to-edge, matching the site-wide `.container max-sm:w-11/12!` rhythm.
  // Embedded mode (no side) stays fluid so the parent section can dictate
  // width — e.g. illinois / bkn / corporate already wrap it in `container mx-auto`.
  protected readonly aspectContainerClasses = computed(() => {
    const base = 'relative overflow-hidden rounded-xl w-full md:aspect-video aspect-9/16 ';
    if (!this.side()) return base;
    // `w-11/12!` overrides the unconditional `w-full` in `base` on mobile so the
    // hero player keeps a gutter and its rounded corners read (matches the
    // site-wide `.container max-sm:w-11/12!` rhythm).
    return `${base} `;
  });
}

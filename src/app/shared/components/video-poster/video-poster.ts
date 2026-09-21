import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog } from '../../core/services/dialog/dialog';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matPlayArrowRound,
  matPauseRound,
  matVolumeUpRound,
  matVolumeOffRound,
} from '@ng-icons/material-icons/round';

/**
 * A reusable video component with delayed autoplay and poster support.
 *
 * SOLID Principles applied:
 * - Single Responsibility: Handles only video playback with poster delay
 * - Open/Closed: Configurable via inputs (posterDelay, loop, muted)
 * - Dependency Inversion: Uses Angular DI for platform detection
 *
 * Features:
 * - Shows poster image for configurable duration before autoplay
 * - SSR-safe using afterNextRender
 * - Handles browser autoplay policy gracefully
 * - Pauses on tab blur/visibility change, resumes on return
 * - Emits events for play/pause state changes
 *
 * @example
 * ```html
 * <app-video-poster
 *   [videoSrc]="item.thumbnail_gif"
 *   [posterSrc]="item.horizontal_thumbnail"
 *   [posterDelay]="3000"
 *   [showControls]="true"
 * />
 * ```
 */
@Component({
  selector: 'app-video-poster',
  imports: [NgIcon],
  templateUrl: './video-poster.html',
  styleUrl: './video-poster.css',
  providers: [
    provideIcons({
      matPlayArrowRound,
      matPauseRound,
      matVolumeUpRound,
      matVolumeOffRound,
    }),
  ],
  host: {
    class: 'block w-full h-full',
    '(window:blur)': 'onWindowBlur()',
    '(window:focus)': 'onWindowFocus()',
    '(document:visibilitychange)': 'onVisibilityChange()',
  },
})
export class VideoPoster {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(Dialog);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostElement = inject(ElementRef);
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Track if video was playing before visibility change */
  private wasPlayingBeforeHidden = false;

  /** Track if video is currently in the viewport */
  private isIntersecting = false;

  /** Observer for tracking visibility */
  private intersectionObserver: IntersectionObserver | null = null;

  /** Reference to the video element */
  private readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  /** Video source URL (e.g., thumbnail_gif) */
  readonly videoSrc = input.required<string>();

  /** Poster image URL (e.g., horizontal_thumbnail) */
  readonly posterSrc = input.required<string>();

  /** Delay in milliseconds before video starts playing (default: 3000ms) */
  readonly posterDelay = input<number>(3000);

  /** Whether the video should loop (default: true) */
  readonly loop = input<boolean>(true);

  /** Whether the video should be muted initially (default: true, required for autoplay) */
  readonly muted = input<boolean>(true);

  /** Whether to show video controls (play/pause, mute/unmute) */
  readonly showControls = input<boolean>(false);

  /** Position of the controls (default: 'bottom-right') */
  readonly controlsPosition = input<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>(
    'bottom-right',
  );

  /** Additional CSS classes for the video element */
  readonly videoClass = input<string>('');

  /**
   * Native `<video preload>` hint. Defaults to `'none'` so the (often multi-MB)
   * source is NOT fetched on load — playback is JS-triggered after `posterDelay`
   * and only for the in-viewport instance, so the poster carries the first paint
   * and the bytes download lazily on play. This is what stops the home hero from
   * eagerly pulling both the desktop (~11MB) and mobile (~23MB) background videos
   * (one is always CSS-hidden). Callers that need instant playback can pass
   * `'metadata'` or `'auto'`.
   */
  readonly preload = input<'none' | 'metadata' | 'auto'>('none');

  /** Signal indicating whether the video is currently playing */
  readonly isPlaying = signal(false);

  /** Signal indicating whether the video is muted */
  readonly isMuted = signal(true);

  /** Signal indicating whether the poster has finished displaying */
  readonly posterComplete = signal(false);

  /** Event emitted when video starts playing */
  readonly videoStarted = output<void>();

  /** Event emitted when video is paused or ended */
  readonly videoStopped = output<void>();

  constructor() {
    afterNextRender(() => {
      // Set initial muted state from input
      this.isMuted.set(this.muted());
      this.schedulePlayback();
    });

    // Pause video when any dialog is opened
    this.dialog.afterOpened$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pauseIfPlaying();
    });

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });

    afterNextRender(() => {
      this.initIntersectionObserver();
    });
  }

  /**
   * Handles document visibility change (tab switch).
   */
  protected onVisibilityChange(): void {
    if (!this.isBrowser) return;

    if (this.document.hidden) {
      this.pauseIfPlaying();
    } else {
      this.resumeIfWasPlaying();
    }
  }

  /**
   * Handles window blur event.
   */
  protected onWindowBlur(): void {
    if (!this.isBrowser) return;
    this.pauseIfPlaying();
  }

  /**
   * Handles window focus event.
   */
  protected onWindowFocus(): void {
    if (!this.isBrowser) return;
    this.resumeIfWasPlaying();
  }

  /**
   * Pauses video if it was playing and stores the state.
   */
  private pauseIfPlaying(): void {
    if (this.isPlaying()) {
      this.wasPlayingBeforeHidden = true;
      this.pause();
    }
  }

  /**
   * Resumes video if it was playing before visibility change.
   */
  private resumeIfWasPlaying(): void {
    if (this.wasPlayingBeforeHidden && this.posterComplete()) {
      this.wasPlayingBeforeHidden = false;
      this.play();
    }
  }

  /**
   * Schedules video playback after the poster delay.
   */
  private schedulePlayback(): void {
    if (!this.isBrowser) return;

    this.timeoutId = setTimeout(() => {
      this.posterComplete.set(true);
      this.playVideo();
    }, this.posterDelay());
  }

  /**
   * Initializes the IntersectionObserver to track viewport visibility.
   */
  private initIntersectionObserver(): void {
    if (!this.isBrowser) return;

    const options = {
      root: null, // viewport
      rootMargin: '0px',
      threshold: 0.5, // 50% visibility required
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        this.isIntersecting = entry.isIntersecting;

        if (entry.isIntersecting) {
          this.resumeIfWasPlaying();
        } else {
          this.pauseIfPlaying();
        }
      });
    }, options);

    // Observe the host element
    const hostEl = this.hostElement.nativeElement;
    this.intersectionObserver.observe(hostEl);
  }

  /**
   * Attempts to play the video, handling browser autoplay policy.
   */
  private playVideo(): void {
    const videoEl = this.videoElement()?.nativeElement;
    if (!videoEl) return;

    // If not in viewport, defer playback logic to IntersectionObserver
    if (!this.isIntersecting) {
      if (!this.isPlaying()) {
        this.wasPlayingBeforeHidden = true;
      }
      return;
    }

    videoEl
      .play()
      .then(() => {
        this.isPlaying.set(true);
        this.videoStarted.emit();
      })
      .catch(() => {
        // Autoplay might be blocked by browser policy
        // Video will remain on poster/first frame
        this.isPlaying.set(false);
      });
  }

  /**
   * Pauses the video playback.
   */
  pause(): void {
    const videoEl = this.videoElement()?.nativeElement;
    if (videoEl) {
      videoEl.pause();
      this.isPlaying.set(false);
      this.videoStopped.emit();
    }
  }

  /**
   * Resumes video playback.
   */
  play(): void {
    this.playVideo();
  }

  /**
   * Toggles play/pause state.
   */
  togglePlay(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Toggles mute/unmute state.
   */
  toggleMute(): void {
    const videoEl = this.videoElement()?.nativeElement;
    if (videoEl) {
      const newMutedState = !this.isMuted();
      videoEl.muted = newMutedState;
      this.isMuted.set(newMutedState);
    }
  }

  /**
   * Handles ratechange event to enforce 1x playback speed.
   * Prevents extensions from modifying the playback rate.
   */
  // protected onRateChange(event: Event): void {
  //   // const videoEl = event.target as HTMLVideoElement;
  //   // if (videoEl.playbackRate !== 1) {
  //   //   videoEl.playbackRate = 1;
  //   // }
  // }

  /**
   * Resets the component to show poster again.
   */
  reset(): void {
    this.cleanup();
    this.posterComplete.set(false);
    this.isPlaying.set(false);
    this.wasPlayingBeforeHidden = false;

    const videoEl = this.videoElement()?.nativeElement;
    if (videoEl) {
      videoEl.pause();
      videoEl.currentTime = 0;
    }

    // Reschedule playback
    if (this.isBrowser) {
      this.schedulePlayback();
    }
  }

  /**
   * Cleans up timeout and video state.
   */
  private cleanup(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
  }
}

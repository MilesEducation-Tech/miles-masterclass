import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { fromEvent, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type Player from 'video.js/dist/types/player';

import { PlayerMode, VideoConfig, VideoSource, VideoState } from '@core/models/video-player.model';
import {
  CPE_CONTROL_BAR,
  DEFAULT_CONTROL_BAR,
  DEFAULT_HLS_CONFIG,
  DEFAULT_VIDEO_CONFIG,
  DEFAULT_YOUTUBE_CONFIG,
} from '@core/constants/video-player';

// Re-export types for consumers
export type {
  VideoConfig,
  VideoSource,
  ControlBarConfig,
  HlsConfig,
  YouTubeConfig,
  VideoErrorEvent,
  VideoMetadataEvent,
  VideoTimeUpdateEvent,
} from '@core/models/video-player.model';

// Re-export enum values (not types)
export { VideoState, PlayerMode } from '@core/models/video-player.model';

@Component({
  selector: 'app-video-js',
  imports: [],
  template: `
    <div class="video-container" [class.cpe-mode]="cpeRestricted()">
      @if (isLoading()) {
        <div class="loading-overlay" [style.background-image]="posterStyle()">
          <div class="loading-spinner" aria-label="Loading video"></div>
        </div>
      }

      <video
        #videoPlayer
        playsinline
        id="video-player"
        class="video-js vjs-default-skin"
        [attr.poster]="mergedConfig().poster"
      ></video>
    </div>
  `,
  styles: `
    .video-container {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .loading-overlay {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(0, 0, 0, 0.8);
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    video {
      width: 100%;
      height: 100%;
    }

    /* CPE Mode Styles — flat selectors (no CSS nesting) so the build can't drop them */
    :host ::ng-deep .cpe-mode .vjs-volume-panel {
      pointer-events: none;
      opacity: 0.5;
      cursor: not-allowed;
    }

    :host ::ng-deep .cpe-mode .vjs-progress-control,
    :host ::ng-deep .vjs-cpe-mode .vjs-progress-control {
      display: none !important;
    }

    /* Same rule for the playback-rate menu button. video.js's own .hide()
       adds .vjs-hidden, but some skins/themes restore it — pin it down with
       a parent-gated rule that matches the progress-control approach. The
       wrapper class video.js renders is the singular .vjs-playback-rate. */
    :host ::ng-deep .cpe-mode .vjs-playback-rate,
    :host ::ng-deep .vjs-cpe-mode .vjs-playback-rate {
      display: none !important;
    }
  `,
  host: {
    class: 'w-full h-full',
  },
})
export class VideoJs {
  /** Expose PlayerMode enum to template */
  protected readonly PlayerMode = PlayerMode;

  private readonly renderer = inject(Renderer2);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  /** Check if running in browser environment */
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /** Required video source(s) - can be a single source or array */
  readonly videoSource = input.required<VideoSource | VideoSource[]>();

  /** Optional video player configuration */
  readonly config = input<VideoConfig>();

  /** Player mode - controls which features are enabled */
  readonly mode = input<PlayerMode>(PlayerMode.DEFAULT);

  /** Whether progress bar interactions are unlocked in CPE mode */
  /* readonly progressUnlocked = input(false); */

  /** Emitted when video state changes */
  readonly stateChange = output<VideoState>();

  /** Emitted when an error occurs */
  readonly error = output<{ code: number; message: string }>();

  /** Emitted when video ends */
  readonly ended = output<void>();

  /** Emitted when video starts playing */
  readonly playing = output<void>();

  /** Emitted when video is paused */
  readonly paused = output<void>();

  /** Emitted when video metadata is loaded */
  readonly metadataLoaded = output<{ duration: number }>();

  /** Emitted when time updates (useful for tracking in CPE mode) */
  readonly timeUpdate = output<{ currentTime: number; duration: number }>();

  /** Emitted whenever the player's playback rate changes */
  readonly playbackRateChange = output<number>();

  /** Live mirror of the underlying player's `playbackRate()`. */
  readonly currentPlaybackRate = signal(1);

  /**
   * True once the player has fired `ended` for the current source. Resets when
   * the source actually changes. Used to lift CPE UI restrictions (seekbar +
   * playback-rate menu) the moment playback completes locally, without waiting
   * for the parent to refresh `play_history.is_completed` from the backend.
   */
  readonly hasEnded = signal(false);

  /** Reference to the video element */
  private readonly videoPlayerRef = viewChild.required<ElementRef<HTMLVideoElement>>('videoPlayer');

  /** Video.js player instance */
  private player: Player | null = null;

  /** Active CPE keydown handler — kept so we can `off()` it when leaving CPE mode */
  private cpeKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

  /** Current video state */
  readonly videoState = signal<VideoState>(VideoState.READY);

  /** Loading state */
  readonly isLoading = signal(true);

  /** Computed sources array */
  private readonly sourcesArray = computed<VideoSource[]>(() => {
    const source = this.videoSource();
    return Array.isArray(source) ? source : [source];
  });

  /** Detect if any source is HLS/m3u8 */
  private readonly isHlsSource = computed(() => {
    return this.sourcesArray().some(
      (s) =>
        s.type === 'application/x-mpegURL' ||
        s.type === 'application/vnd.apple.mpegurl' ||
        s.src.endsWith('.m3u8'),
    );
  });

  /** Detect if any source is YouTube */
  private readonly isYouTubeSource = computed(() => {
    return this.sourcesArray().some(
      (s) =>
        s.type === 'video/youtube' || s.src.includes('youtube.com') || s.src.includes('youtu.be'),
    );
  });

  /** Auto-detect optimal tech order based on source types */
  private readonly autoTechOrder = computed<('youtube' | 'html5')[]>(() => {
    const userTechOrder = this.config()?.techOrder;
    if (userTechOrder) {
      return userTechOrder; // User-specified takes precedence
    }

    // For HLS sources, prioritize html5
    if (this.isHlsSource()) {
      return ['html5', 'youtube'];
    }

    // For YouTube sources, prioritize youtube
    if (this.isYouTubeSource()) {
      return ['youtube', 'html5'];
    }

    // Default: html5 first for regular video files
    return ['html5', 'youtube'];
  });

  /** Merged configuration with defaults based on mode */
  readonly mergedConfig = computed<VideoConfig>(() => {
    const userConfig = this.config();

    // Use the CPE control bar only while CPE restrictions are still active.
    // Once the video has ended in this session, fall back to the default so
    // the seekbar and playback-rate menu reappear together.
    const baseControlBar = this.cpeRestricted() ? CPE_CONTROL_BAR : DEFAULT_CONTROL_BAR;

    return {
      ...DEFAULT_VIDEO_CONFIG,
      ...userConfig,
      techOrder: this.autoTechOrder(),
      controlBar: {
        ...baseControlBar,
        ...userConfig?.controlBar,
      },
      youtube: {
        ...DEFAULT_YOUTUBE_CONFIG,
        ...userConfig?.youtube,
      },
      hls: {
        ...DEFAULT_HLS_CONFIG,
        ...userConfig?.hls,
      },
    };
  });

  /** Check if currently in CPE mode */
  readonly isCpeMode = computed(() => this.mode() === PlayerMode.CPE);

  /**
   * CPE UI restrictions are active only while in CPE mode AND the video has
   * not finished yet. Drives the seekbar + playback-rate menu visibility so
   * both follow the rule: visible iff `!cpe_mode || completed`.
   */
  readonly cpeRestricted = computed(() => this.isCpeMode() && !this.hasEnded());

  /** Computed poster style for loading overlay */
  readonly posterStyle = computed(() => {
    const poster = this.mergedConfig().poster;
    return poster ? `url('${poster}')` : 'none';
  });

  constructor() {
    // Initialize player only in browser after view is ready
    afterNextRender(() => {
      this.initializePlayer();
    });

    // Effect to handle source changes (only runs in browser)
    effect(() => {
      const sources = this.sourcesArray();
      if (this.isBrowser && this.player && sources.length > 0) {
        this.updatePlayerSource(sources);
      }
    });

    // Effect to apply CPE restrictions when mode OR the local "ended" flag
    // changes. Both are read so the effect re-fires when playback completes.
    effect(() => {
      this.mode();
      this.hasEnded();
      if (this.isBrowser && this.player) {
        this.applyModeRestrictions();
      }
    });

    // Effect: live-sync the player with merged config whenever it changes
    // (includes control-bar child visibility, which flips with `mode()`).
    effect(() => {
      const config = this.mergedConfig();
      if (this.isBrowser && this.player) {
        this.applyLiveConfig(config);
      }
    });

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.disposePlayer();
    });

    // Handle visibility changes for CPE mode - only in browser
    if (this.isBrowser) {
      merge(fromEvent(document, 'visibilitychange'), fromEvent(window, 'blur'))
        .pipe(takeUntilDestroyed())
        .subscribe(() => {
          if (this.isCpeMode()) {
            this.player?.pause();
          }
        });
    }
  }

  /** Initialize the Video.js player - only runs in browser */
  private async initializePlayer(): Promise<void> {
    if (!this.isBrowser) {
      return; // Skip initialization on server
    }

    const videoElement = this.videoPlayerRef().nativeElement;
    const config = this.mergedConfig();

    try {
      // Dynamic import to avoid SSR issues
      const [{ default: videojs }] = await Promise.all([
        import('video.js'),
        import('videojs-youtube'),
        import('@videojs/http-streaming'),
      ]);

      this.player = videojs(videoElement, {
        controls: config.controls,
        autoplay: config.autoplay,
        preload: config.preload,
        loop: config.loop,
        fluid: config.fluid,
        responsive: config.responsive,
        muted: config.muted,
        poster: config.poster,
        techOrder: config.techOrder,
        sources: this.sourcesArray(),
        // video.js renders `playbackRateMenuButton` only when a rates list is
        // configured here; otherwise the control-bar child stays hidden.
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
        html5: {
          vhs: {
            enableLowInitialPlaylist: config.hls?.enableLowInitialPlaylist ?? true,
            smoothQualityChange: config.hls?.smoothQualityChange ?? true,
            overrideNative: config.hls?.overrideNative ?? true,
            useDevicePixelRatio: config.hls?.useDevicePixelRatio ?? true,
            bandwidth: config.hls?.bandwidth,
            allowSeeksWithinUnsafeLiveWindow: config.hls?.allowSeeksWithinUnsafeLiveWindow ?? true,
          },
          nativeAudioTracks: false,
          nativeVideoTracks: false,
        },
        // Always instantiate every known control-bar child so we can toggle
        // visibility live via show()/hide() when the mode/config changes.
        // Visibility for the *current* mode is applied in handlePlayerReady
        // via syncControlBarVisibility.
        controlBar: {
          playToggle: true,
          volumePanel: true,
          currentTimeDisplay: true,
          timeDivider: true,
          durationDisplay: true,
          progressControl: true,
          remainingTimeDisplay: true,
          fullscreenToggle: true,
          pictureInPictureToggle: true,
          playbackRateMenuButton: true,
          customControlSpacer: false,
          chaptersButton: false,
          descriptionsButton: false,
          subsCapsButton: false,
          audioTrackButton: false,
        },
        youtube: config.youtube,
      });

      this.player.ready(() => {
        this.handlePlayerReady();
      });
    } catch (err) {
      this.handleError(err);
    }
  }

  /** Handle player ready state */
  private handlePlayerReady(): void {
    this.updateState(VideoState.READY);
    this.isLoading.set(false);

    this.setupPlayerEvents();
    this.setupIframePointerEvents();

    // Initial sync — effects don't re-fire just because `this.player` went
    // from null to assigned, so kick them manually here.
    const config = this.mergedConfig();
    this.applyLiveConfig(config);
    this.applyModeRestrictions();

    if (config.fullScreenOnReady && this.player) {
      this.player?.requestFullscreen();
    }
  }

  /** Apply CPE restrictions (CSS class + keyboard handler + progress-bar hard-hide).
   * Reads `cpeRestricted()` so both `mode` changes and the local `hasEnded`
   * flag drive the lock/unlock from one place. */
  private applyModeRestrictions(): void {
    if (!this.player) return;

    // Detach any previous keydown handler before re-evaluating. Without this,
    // every transition into CPE would stack another listener.
    if (this.cpeKeydownHandler) {
      this.player.off('keydown', this.cpeKeydownHandler);
      this.cpeKeydownHandler = null;
    }

    const restricted = this.cpeRestricted();

    if (restricted) {
      this.player.addClass('vjs-cpe-mode');
      this.cpeKeydownHandler = this.buildCpeKeydownHandler();
      this.player.on('keydown', this.cpeKeydownHandler);
    } else {
      this.player.removeClass('vjs-cpe-mode');
    }

    // Belt-and-suspenders: write `display: none !important` directly as an
    // inline style on every `.vjs-progress-control` AND `.vjs-playback-rate`
    // in the player subtree. Inline `!important` wins over every class-based
    // rule and cannot be undone by videojs internals calling `show()` on the
    // child — which `syncControlBarVisibility` does later via the control bar
    // config, and which has been observed to leak the playback-rate menu
    // through in CPE mode.
    const playerEl = this.player.el() as HTMLElement | null;
    if (!playerEl) return;
    const lockedEls = playerEl.querySelectorAll<HTMLElement>(
      '.vjs-progress-control, .vjs-playback-rate',
    );
    lockedEls.forEach((el) => {
      if (restricted) {
        el.style.setProperty('display', 'none', 'important');
      } else {
        el.style.removeProperty('display');
      }
    });
  }

  /** Build a CPE keydown handler that blocks everything except play/pause + fullscreen */
  private buildCpeKeydownHandler(): (event: KeyboardEvent) => void {
    const allowedKeys = new Set([
      'Space', // Play/pause
      ' ', // Play/pause (alternative)
      'KeyK', // Play/pause
      'KeyF', // Fullscreen
      'Escape', // Exit fullscreen
    ]);

    return (event: KeyboardEvent) => {
      const key = event.code || event.key;
      if (!allowedKeys.has(key)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
  }

  /**
   * Live-sync the player with the merged config. Uses video.js setters so we
   * never dispose/rebuild on mode or config changes — only properties that
   * actually differ are written.
   */
  private applyLiveConfig(config: VideoConfig): void {
    if (!this.player) return;

    if (config.poster !== undefined && config.poster !== this.player.poster()) {
      this.player.poster(config.poster);
    }
    if (config.controls !== undefined && config.controls !== this.player.controls()) {
      this.player.controls(config.controls);
    }
    if (config.loop !== undefined && config.loop !== this.player.loop()) {
      this.player.loop(config.loop);
    }
    if (config.muted !== undefined && config.muted !== this.player.muted()) {
      this.player.muted(config.muted);
    }
    if (config.autoplay !== undefined && config.autoplay !== this.player.autoplay()) {
      this.player.autoplay(config.autoplay);
    }
    if (config.preload !== undefined && config.preload !== this.player.preload()) {
      this.player.preload(config.preload);
    }
    if (config.fluid !== undefined && config.fluid !== this.player.fluid()) {
      this.player.fluid(config.fluid);
    }
    if (config.responsive !== undefined && config.responsive !== this.player.responsive()) {
      this.player.responsive(config.responsive);
    }

    this.syncControlBarVisibility(config.controlBar);
  }

  /**
   * Toggle control-bar child visibility via Component.show()/hide() (adds/removes
   * the stock `vjs-hidden` class) based on the merged controlBar config. This is
   * the live counterpart to the init-time `controlBar: { ... }` options.
   */
  private syncControlBarVisibility(cbConfig: VideoConfig['controlBar']): void {
    const controlBar = this.player?.getChild('controlBar');
    if (!controlBar || !cbConfig) return;

    const entries: [string, boolean | undefined][] = [
      ['playToggle', cbConfig.playToggle],
      ['volumePanel', cbConfig.volumePanel],
      ['currentTimeDisplay', cbConfig.currentTimeDisplay],
      ['timeDivider', cbConfig.timeDivider],
      ['durationDisplay', cbConfig.durationDisplay],
      ['progressControl', cbConfig.progressControl],
      ['remainingTimeDisplay', cbConfig.remainingTimeDisplay],
      ['fullscreenToggle', cbConfig.fullscreenToggle],
      ['pictureInPictureToggle', cbConfig.pictureInPictureToggle],
      ['playbackRateMenuButton', cbConfig.playbackRatesMenuButton],
    ];

    for (const [name, visible] of entries) {
      const child = controlBar.getChild(name);
      if (!child) continue;
      if (visible === false) {
        child.hide();
      } else {
        child.show();
      }
    }
  }

  /** Setup all player event listeners */
  private setupPlayerEvents(): void {
    if (!this.player) return;

    this.player.on('playing', () => {
      this.updateState(VideoState.PLAYING);
      this.isLoading.set(false);
      this.playing.emit();
    });

    this.player.on('pause', () => {
      this.updateState(VideoState.PAUSED);
      this.paused.emit();
    });

    this.player.on('waiting', () => {
      this.updateState(VideoState.BUFFERING);
      this.isLoading.set(true);
    });

    this.player.on('canplay', () => {
      this.isLoading.set(false);
    });

    this.player.on('canplaythrough', () => {
      this.isLoading.set(false);
    });

    this.player.on('loadeddata', () => {
      this.isLoading.set(false);
    });

    this.player.on('ended', () => {
      this.updateState(VideoState.ENDED);
      this.hasEnded.set(true);
      this.ended.emit();
    });

    this.player.on('loadedmetadata', () => {
      const duration = this.player?.duration() ?? 0;
      this.metadataLoaded.emit({ duration });
    });

    // Time update for CPE tracking
    this.player.on('timeupdate', () => {
      const currentTime = this.player?.currentTime() ?? 0;
      const duration = this.player?.duration() ?? 0;
      this.timeUpdate.emit({ currentTime, duration });
    });

    this.player.on('error', () => {
      const error = this.player?.error();
      this.updateState(VideoState.ERROR);
      this.isLoading.set(false);
      if (error) {
        this.error.emit({ code: error.code ?? 0, message: error.message ?? 'Unknown error' });
      }
    });

    // Mirror playbackRate changes so consumers can react and we can confirm
    // the built-in PlaybackRate menu actually fired the change.
    this.player.on('ratechange', () => {
      const rate = this.player?.playbackRate() ?? 1;
      this.currentPlaybackRate.set(rate);
      this.playbackRateChange.emit(rate);
    });
  }

  /** Update video state and emit change */
  private updateState(state: VideoState): void {
    this.videoState.set(state);
    this.stateChange.emit(state);
  }

  /** Setup iframe pointer events for YouTube embeds */
  private setupIframePointerEvents(): void {
    // Delay to ensure iframe is rendered
    setTimeout(() => {
      const iframe = this.el.nativeElement.querySelector('iframe#video-player_youtube_api');
      if (iframe) {
        this.renderer.setStyle(iframe, 'pointer-events', 'none');
      }
    }, 1000);
  }

  /** Update player source dynamically */
  private updatePlayerSource(sources: VideoSource[]): void {
    if (!this.player) return;

    // Check if sources are identical to current source to prevent unnecessary reloads
    const currentSrc = this.player.currentSrc();
    const newSrc = sources[0]?.src;

    // Simplistic check for single source scenarios (most common)
    // If the player has a source and the new source URL matches (handling potential absolute/relative diffs loosely)
    if (
      currentSrc &&
      newSrc &&
      (currentSrc === newSrc || currentSrc.endsWith(newSrc) || newSrc.endsWith(currentSrc))
    ) {
      // Source hasn't changed - ensure loading is false
      this.isLoading.set(false);
      return;
    }

    // New source — re-lock CPE restrictions until this clip is also watched through.
    this.hasEnded.set(false);

    // A new source resets the media element's playbackRate to 1x AND leaves the
    // clip paused (load() stops playback). Once the new media is loaded, re-apply
    // the user's speed so playback and the PlaybackRate menu label agree, and
    // resume if the previous chapter was playing — so switching chapters is
    // seamless and the chosen speed carries across.
    const rate = this.currentPlaybackRate();
    const wasPlaying = !this.player.paused();
    if (rate !== 1 || wasPlaying) {
      this.player.one('loadeddata', () => {
        if (rate !== 1) this.player?.playbackRate(rate);
        if (wasPlaying) void this.player?.play();
      });
    }

    this.isLoading.set(true);
    this.player.src(sources);
    this.player.load();

    // Safety timeout to ensure loading state gets reset even if events fail
    setTimeout(() => {
      if (this.isLoading()) {
        this.isLoading.set(false);
      }
    }, 10000);
  }

  /** Handle initialization errors */
  private handleError(err: unknown): void {
    this.updateState(VideoState.ERROR);
    this.isLoading.set(false);

    const message = err instanceof Error ? err.message : 'Failed to initialize video player';
    this.error.emit({ code: -1, message });
  }

  /** Dispose the player */
  private disposePlayer(): void {
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /** Play the video */
  play(): void {
    this.player?.play();
  }

  /** Pause the video */
  pause(): void {
    this.player?.pause();
  }

  /** Toggle play/pause state */
  togglePlay(): void {
    if (this.player?.paused()) {
      this.player.play();
    } else {
      this.player?.pause();
    }
  }

  /**
   * Seek to a specific time in seconds
   * Note: This is disabled in CPE mode - returns early without seeking
   */
  seek(time: number, force = false): void {
    if (this.isCpeMode() && !force) {
      return; // Seeking disabled in CPE mode unless forced
    }
    this.player?.currentTime(time);
  }

  /** Get current playback time in seconds */
  getCurrentTime(): number {
    return this.player?.currentTime() ?? 0;
  }

  /** Get video duration in seconds */
  getDuration(): number {
    return this.player?.duration() ?? 0;
  }

  /**
   * Set volume (0-1)
   * Note: This is disabled in CPE mode - returns early without changing volume
   */
  setVolume(volume: number): void {
    if (this.isCpeMode()) {
      return; // Volume control disabled in CPE mode
    }
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.player?.volume(clampedVolume);
  }

  /** Get current volume (0-1) */
  getVolume(): number {
    return this.player?.volume() ?? 1;
  }

  /**
   * Mute the video
   * Note: This is disabled in CPE mode
   */
  mute(): void {
    if (this.isCpeMode()) {
      return;
    }
    this.player?.muted(true);
  }

  /**
   * Unmute the video
   * Note: This is disabled in CPE mode
   */
  unmute(): void {
    if (this.isCpeMode()) {
      return;
    }
    this.player?.muted(false);
  }

  /**
   * Toggle mute state
   * Note: This is disabled in CPE mode
   */
  toggleMute(): void {
    if (this.isCpeMode()) {
      return;
    }
    this.player?.muted(!this.player.muted());
  }

  /** Check if video is muted */
  isMuted(): boolean {
    return this.player?.muted() ?? false;
  }

  /** Request fullscreen (allowed in all modes) */
  requestFullscreen(): void {
    this.player?.requestFullscreen();
  }

  /** Exit fullscreen (allowed in all modes) */
  exitFullscreen(): void {
    this.player?.exitFullscreen();
  }

  /** Check if player is in fullscreen mode */
  isFullscreen(): boolean {
    return this.player?.isFullscreen() ?? false;
  }

  /**
   * Set playback rate (e.g., 0.5, 1, 1.5, 2)
   * Note: This is disabled in CPE mode
   */
  setPlaybackRate(rate: number): void {
    if (this.isCpeMode()) {
      return;
    }
    this.player?.playbackRate(rate);
  }

  /** Get current playback rate */
  getPlaybackRate(): number {
    return this.player?.playbackRate() ?? 1;
  }

  /** Show or hide progress bar and time displays */
  setProgressBarVisibility(visible: boolean): void {
    // Access controlBar through getChild since direct property access is not typed
    const controlBar = this.player?.getChild('controlBar');
    if (!controlBar) return;

    const display = visible ? '' : 'none';

    const progressControl = controlBar.getChild('progressControl');
    const currentTimeDisplay = controlBar.getChild('currentTimeDisplay');
    const remainingTimeDisplay = controlBar.getChild('remainingTimeDisplay');

    if (progressControl?.el()) {
      this.renderer.setStyle(progressControl.el(), 'display', display);
    }
    if (currentTimeDisplay?.el()) {
      this.renderer.setStyle(currentTimeDisplay.el(), 'display', display);
    }
    if (remainingTimeDisplay?.el()) {
      this.renderer.setStyle(remainingTimeDisplay.el(), 'display', display);
    }
  }

  /** Get the current player mode */
  getPlayerMode(): PlayerMode {
    return this.mode();
  }

  /** Check if a specific control is enabled in current mode */
  isControlEnabled(control: 'seek' | 'volume' | 'playbackRate' | 'play' | 'fullscreen'): boolean {
    if (this.mode() === PlayerMode.CPE) {
      return control === 'play' || control === 'fullscreen';
    }
    return true;
  }
}

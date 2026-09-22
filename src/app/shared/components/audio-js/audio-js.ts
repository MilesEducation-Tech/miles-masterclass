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
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matVolumeUpRound,
  matVolumeOffRound,
  matPlayArrowRound,
  matPauseRound,
  matReplay10Round,
  matForward10Round,
} from '@ng-icons/material-icons/round';
import { fromEvent, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type Player from 'video.js/dist/types/player';

import { PlayerMode, VideoConfig, VideoSource, VideoState } from '@core/models/video-player.model';
import {
  CPE_CONTROL_BAR,
  DEFAULT_CONTROL_BAR,
  DEFAULT_HLS_CONFIG,
  DEFAULT_VIDEO_CONFIG,
} from '@core/constants/video-player';

// Re-export types for consumers
export type {
  VideoConfig,
  VideoSource,
  ControlBarConfig,
  HlsConfig,
  VideoErrorEvent,
  VideoMetadataEvent,
  VideoTimeUpdateEvent,
} from '@core/models/video-player.model';

// Re-export enum values (not types)
export { VideoState, PlayerMode } from '@core/models/video-player.model';

@Component({
  selector: 'app-audio-js',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      matVolumeUpRound,
      matVolumeOffRound,
      matPlayArrowRound,
      matPauseRound,
      matReplay10Round,
      matForward10Round,
    }),
  ],
  template: `
    <div class="overflow-visible w-full flex flex-col gap-4 relative">
      <!-- Hidden video.js audio element -->
      <audio
        #audioPlayer
        playsinline
        id="audio-player"
        class="video-js vjs-default-skin vjs-audio"
      ></audio>

      <!-- Custom UI overlay -->
      <div
        class="flex flex-col md:w-3/4 w-full px-3 gap-3 mx-auto overflow-visible"
        [class.pointer-events-none]="isLoading()"
        [class.opacity-50]="isLoading()"
      >
        <!-- Top row: Volume | Play Controls | Spacer -->
        <div class="flex justify-between gap-3 max-md:flex-col-reverse">
          <!-- Left: Volume -->
          <div class="left flex items-center md:gap-4 gap-2 md:min-w-28">
            <button
              type="button"
              class="text-white/70 hover:text-white transition-colors cursor-pointer"
              (click)="handleToggleMute()"
              [attr.aria-label]="uiMuted() ? 'Unmute' : 'Mute'"
            >
              <ng-icon
                [name]="uiMuted() ? 'matVolumeOffRound' : 'matVolumeUpRound'"
                size="24"
                aria-hidden="true"
              />
            </button>
            <input
              type="range"
              min="0"
              max="100"
              [value]="uiVolume()"
              (input)="onVolumeSliderChange($any($event).target.value)"
              class="volume-slider w-20 h-1 cursor-pointer"
              aria-label="Volume"
            />
          </div>

          <!-- Middle: Playback Controls -->
          <div class="middle flex items-center justify-center md:gap-4 gap-2 md:min-w-28">
            @if (!cpeRestricted()) {
              <button
                type="button"
                class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                (click)="handleSeek(-10)"
                aria-label="Seek backward 10 seconds"
              >
                <ng-icon name="matReplay10Round" size="24" aria-hidden="true" />
              </button>
            }
            <button
              type="button"
              class="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all cursor-pointer active:scale-95"
              (click)="handleTogglePlay()"
              [attr.aria-label]="uiPlaying() ? 'Pause' : 'Play'"
            >
              <ng-icon
                [name]="uiPlaying() ? 'matPauseRound' : 'matPlayArrowRound'"
                size="32"
                aria-hidden="true"
              />
            </button>
            @if (!cpeRestricted()) {
              <button
                type="button"
                class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                (click)="handleSeek(10)"
                aria-label="Seek forward 10 seconds"
              >
                <ng-icon name="matForward10Round" size="24" aria-hidden="true" />
              </button>
            }
          </div>

          <!-- Right: Playback speed -->
          <div class="right flex items-center justify-end gap-2 max-md:hidden md:min-w-28">
            @if (!cpeRestricted()) {
              <div class="relative">
                <button
                  type="button"
                  class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 rounded transition-colors cursor-pointer"
                  (click)="togglePlaybackMenu()"
                  aria-label="Playback speed"
                >
                  {{ uiPlaybackRate() }}x
                  <span class="text-[10px]">▼</span>
                </button>
                @if (showPlaybackMenu()) {
                  <div
                    class="absolute bottom-full right-0 mb-1 bg-gray-800 rounded-lg shadow-xl border border-white/10 overflow-hidden z-50"
                  >
                    @for (rate of playbackRates; track rate) {
                      <button
                        type="button"
                        class="block w-full px-4 py-1.5 text-xs text-center text-gray-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                        [class.text-blue-400]="uiPlaybackRate() === rate"
                        [class.font-bold]="uiPlaybackRate() === rate"
                        (click)="changePlaybackRate(rate)"
                      >
                        {{ rate }}x
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Bottom row: Progress slider + time -->
        <div class="flex flex-col gap-1">
          <input
            type="range"
            min="0"
            [max]="uiDuration()"
            [value]="uiCurrentTime()"
            (input)="onProgressSliderChange($any($event).target.value)"
            [disabled]="cpeRestricted()"
            class="progress-slider w-full h-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Audio progress"
          />
          <div class="flex justify-between items-center">
            <p class="text-xs font-medium text-gray-400">
              {{ formatTime(uiCurrentTime()) }}
            </p>
            <p class="text-xs font-medium text-gray-400">
              {{ formatTime(uiDuration()) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Loading spinner -->
      @if (isLoading()) {
        <div class="flex items-center justify-center py-2 absolute top-1/2 left-1/2 -translate-1/2">
          <div
            class="w-6 h-6 border-[3px] border-white/10 border-t-blue-500 rounded-full animate-spin"
            aria-label="Loading audio"
          ></div>
        </div>
      }
    </div>
  `,
  styles: `
    /* Hide native video.js controls entirely */
    :host ::ng-deep .vjs-audio.video-js {
      width: 0;
      height: 0;
      position: absolute;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    }

    /* Custom range slider styling */
    .progress-slider,
    .volume-slider {
      -webkit-appearance: none;
      appearance: none;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      outline: none;
    }

    .progress-slider::-webkit-slider-thumb,
    .volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #3b82f6;
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
    }

    .progress-slider::-moz-range-thumb,
    .volume-slider::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #3b82f6;
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
    }

    .progress-slider:disabled::-webkit-slider-thumb {
      background: #6b7280;
      cursor: not-allowed;
    }

    .progress-slider:disabled::-moz-range-thumb {
      background: #6b7280;
      cursor: not-allowed;
    }
  `,
  host: {
    class: 'block w-full',
  },
})
export class AudioJs {
  protected readonly PlayerMode = PlayerMode;

  private readonly renderer = inject(Renderer2);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly videoSource = input.required<VideoSource | VideoSource[]>();
  readonly config = input<VideoConfig>();
  readonly mode = input<PlayerMode>(PlayerMode.DEFAULT);

  readonly stateChange = output<VideoState>();
  readonly error = output<{ code: number; message: string }>();
  readonly ended = output<void>();
  readonly playing = output<void>();
  readonly paused = output<void>();
  readonly metadataLoaded = output<{ duration: number }>();
  readonly timeUpdate = output<{ currentTime: number; duration: number }>();

  private readonly audioPlayerRef = viewChild.required<ElementRef<HTMLAudioElement>>('audioPlayer');

  private player: Player | null = null;
  /** Reference to the bound CPE keydown handler so we can detach it. Without
   * a stored reference, `applyModeRestrictions` would stack a new listener
   * every time CPE mode is entered, with no way to remove the previous ones. */
  private cpeKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  readonly videoState = signal<VideoState>(VideoState.READY);
  readonly isLoading = signal(true);

  // --- UI State Signals ---
  readonly uiCurrentTime = signal(0);
  readonly uiDuration = signal(0);
  readonly uiPlaying = signal(false);
  readonly uiVolume = signal(100);
  readonly uiMuted = signal(false);
  readonly uiPlaybackRate = signal(1);
  readonly showPlaybackMenu = signal(false);

  /**
   * True once the player has fired `ended` for the current source. Resets when
   * the source actually changes. Lifts CPE UI restrictions (seekbar + playback-
   * rate menu) the moment playback completes locally, without waiting for the
   * parent to refresh `play_history.is_completed` from the backend.
   */
  readonly hasEnded = signal(false);

  readonly playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

  private readonly sourcesArray = computed<VideoSource[]>(() => {
    const source = this.videoSource();
    return Array.isArray(source) ? source : [source];
  });

  private readonly isHlsSource = computed(() => {
    return this.sourcesArray().some(
      (s) =>
        s.type === 'application/x-mpegURL' ||
        s.type === 'application/vnd.apple.mpegurl' ||
        s.src.endsWith('.m3u8'),
    );
  });

  private readonly autoTechOrder = computed<('youtube' | 'html5')[]>(() => {
    const userTechOrder = this.config()?.techOrder;
    if (userTechOrder) {
      return userTechOrder;
    }

    if (this.isHlsSource()) {
      return ['html5'];
    }

    return ['html5'];
  });

  readonly mergedConfig = computed<VideoConfig>(() => {
    const userConfig = this.config();

    // Native control bar is disabled at init (`controlBar: false`), so this
    // is essentially dead config — but keep the rule consistent with video-js
    // so anyone reading the two side-by-side sees the same gate.
    const baseControlBar = this.cpeRestricted() ? CPE_CONTROL_BAR : DEFAULT_CONTROL_BAR;

    return {
      ...DEFAULT_VIDEO_CONFIG,
      ...userConfig,
      techOrder: this.autoTechOrder(),
      fluid: false, // Must be false for audio fixed height
      controlBar: {
        ...baseControlBar,
        ...userConfig?.controlBar,
        fullscreenToggle: false, // Explicitly false for audio
        pictureInPictureToggle: false,
      },
      hls: {
        ...DEFAULT_HLS_CONFIG,
        ...userConfig?.hls,
      },
    };
  });

  readonly isCpeMode = computed(() => this.mode() === PlayerMode.CPE);

  /**
   * CPE UI restrictions are active only while in CPE mode AND the audio has
   * not finished yet. Drives the seekbar + playback-rate menu visibility so
   * both follow the rule: visible iff `!cpe_mode || completed`.
   */
  readonly cpeRestricted = computed(() => this.isCpeMode() && !this.hasEnded());

  constructor() {
    afterNextRender(() => {
      this.initializePlayer();
    });

    effect(() => {
      const sources = this.sourcesArray();
      if (this.isBrowser && this.player && sources.length > 0) {
        this.updatePlayerSource(sources);
      }
    });

    // Re-fire whenever mode OR the local "ended" flag changes so the keydown
    // handler and `vjs-cpe-mode` class track `cpeRestricted()`.
    effect(() => {
      this.mode();
      this.hasEnded();
      if (this.isBrowser && this.player) {
        this.applyModeRestrictions();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.disposePlayer();
    });

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

  // --- Custom UI Methods (bypass CPE guards — template controls visibility) ---

  formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /** Internal: toggle mute directly on player (volume always works) */
  handleToggleMute() {
    if (!this.player) return;
    this.player.muted(!this.player.muted());
  }

  /** Internal: toggle play/pause directly on player */
  handleTogglePlay() {
    if (!this.player) return;
    if (this.player.paused()) {
      this.player.play();
    } else {
      this.player.pause();
    }
  }

  /** Internal: seek relative to current time (e.g. -10 or +10) */
  handleSeek(offsetSeconds: number) {
    if (!this.player) return;
    const newTime = Math.max(0, (this.player.currentTime() ?? 0) + offsetSeconds);
    this.player.currentTime(newTime);
  }

  onVolumeSliderChange(value: string) {
    if (!this.player) return;
    const vol = Number(value) / 100;
    const clamped = Math.max(0, Math.min(1, vol));
    this.player.volume(clamped);
    this.uiVolume.set(Number(value));
    if (clamped > 0 && this.player.muted()) {
      this.player.muted(false);
    }
  }

  onProgressSliderChange(value: string) {
    if (!this.player) return;
    const time = Number(value);
    this.player.currentTime(time);
    this.uiCurrentTime.set(time);
  }

  togglePlaybackMenu() {
    this.showPlaybackMenu.update((v) => !v);
  }

  changePlaybackRate(rate: number) {
    if (!this.player) return;
    this.player.playbackRate(rate);
    this.uiPlaybackRate.set(rate);
    this.showPlaybackMenu.set(false);
  }

  // --- Player Initialization ---

  private async initializePlayer(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    const audioElement = this.audioPlayerRef().nativeElement;
    const config = this.mergedConfig();

    try {
      const [{ default: videojs }] = await Promise.all([
        import('video.js'),
        import('@videojs/http-streaming'),
      ]);

      this.player = videojs(audioElement, {
        controls: false, // Hide native controls — using custom UI
        autoplay: config.autoplay,
        preload: config.preload,
        loop: config.loop,
        fluid: false,
        responsive: config.responsive,
        muted: config.muted,
        techOrder: config.techOrder,
        sources: this.sourcesArray(),
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
        controlBar: false, // No native control bar
      });

      this.player.ready(() => {
        this.handlePlayerReady();
      });
    } catch (err) {
      this.handleError(err);
    }
  }

  private handlePlayerReady(): void {
    this.updateState(VideoState.READY);
    this.isLoading.set(false);

    this.setupPlayerEvents();
    this.applyModeRestrictions();
  }

  /** Apply CPE restrictions (keydown lock + `vjs-cpe-mode` class). Reads
   * `cpeRestricted()` so both `mode` changes and the local `hasEnded` flag
   * drive the lock/unlock from one place. */
  private applyModeRestrictions(): void {
    if (!this.player) return;

    // Detach any previous keydown handler before re-evaluating. Without this,
    // every transition into CPE would stack another listener.
    if (this.cpeKeydownHandler) {
      this.player.off('keydown', this.cpeKeydownHandler);
      this.cpeKeydownHandler = null;
    }

    if (this.cpeRestricted()) {
      this.cpeKeydownHandler = this.buildCpeKeydownHandler();
      this.player.on('keydown', this.cpeKeydownHandler);
      this.player.addClass('vjs-cpe-mode');
    } else {
      this.player.removeClass('vjs-cpe-mode');
    }
  }

  private buildCpeKeydownHandler(): (event: KeyboardEvent) => void {
    return (event: KeyboardEvent) => {
      const allowedKeys = ['Space', ' ', 'KeyK'];

      const key = event.code || event.key;

      if (!allowedKeys.includes(key)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
  }

  private setupPlayerEvents(): void {
    if (!this.player) return;

    this.player.on('playing', () => {
      this.updateState(VideoState.PLAYING);
      this.isLoading.set(false);
      this.uiPlaying.set(true);
      this.playing.emit();
    });

    this.player.on('pause', () => {
      this.updateState(VideoState.PAUSED);
      this.uiPlaying.set(false);
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
      this.uiPlaying.set(false);
      this.hasEnded.set(true);
      this.ended.emit();
    });

    this.player.on('loadedmetadata', () => {
      const duration = this.player?.duration() ?? 0;
      this.uiDuration.set(duration);
      this.metadataLoaded.emit({ duration });
    });

    this.player.on('timeupdate', () => {
      const currentTime = this.player?.currentTime() ?? 0;
      const duration = this.player?.duration() ?? 0;
      this.uiCurrentTime.set(currentTime);
      if (duration > 0) {
        this.uiDuration.set(duration);
      }
      this.timeUpdate.emit({ duration, currentTime });
    });

    this.player.on('volumechange', () => {
      const vol = this.player?.volume() ?? 1;
      const muted = this.player?.muted() ?? false;
      this.uiVolume.set(Math.round(vol * 100));
      this.uiMuted.set(muted);
    });

    this.player.on('ratechange', () => {
      this.uiPlaybackRate.set(this.player?.playbackRate() ?? 1);
    });

    this.player.on('error', () => {
      const error = this.player?.error();
      this.updateState(VideoState.ERROR);
      this.isLoading.set(false);
      if (error) {
        this.error.emit({ code: error.code ?? 0, message: error.message ?? 'Unknown error' });
      }
    });
  }

  private updateState(state: VideoState): void {
    this.videoState.set(state);
    this.stateChange.emit(state);
  }

  private updatePlayerSource(sources: VideoSource[]): void {
    if (!this.player) return;

    const currentSrc = this.player.currentSrc();
    const newSrc = sources[0]?.src;

    if (
      currentSrc &&
      newSrc &&
      (currentSrc === newSrc || currentSrc.endsWith(newSrc) || newSrc.endsWith(currentSrc))
    ) {
      this.isLoading.set(false);
      return;
    }

    // New source — re-lock CPE restrictions until this clip is also watched through.
    this.hasEnded.set(false);

    // Mirror video-js: load() resets playbackRate to 1x and pauses the clip.
    // Re-apply the chosen speed and resume (if it was playing) once the new
    // media is loaded, so chapter switches stay seamless and the speed label
    // matches actual playback.
    const rate = this.uiPlaybackRate();
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

    setTimeout(() => {
      if (this.isLoading()) {
        this.isLoading.set(false);
      }
    }, 10000);
  }

  private handleError(err: unknown): void {
    this.updateState(VideoState.ERROR);
    this.isLoading.set(false);

    const message = err instanceof Error ? err.message : 'Failed to initialize audio player';
    this.error.emit({ code: -1, message });
  }

  private disposePlayer(): void {
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }
  }

  // --- Public API (kept for backward compatibility) ---

  play(): void {
    this.player?.play();
  }

  pause(): void {
    this.player?.pause();
  }

  togglePlay(): void {
    if (this.player?.paused()) {
      this.player.play();
    } else {
      this.player?.pause();
    }
  }

  seek(time: number, force = false): void {
    if (this.isCpeMode() && !force) {
      return;
    }
    this.player?.currentTime(time);
  }

  getCurrentTime(): number {
    return this.player?.currentTime() ?? 0;
  }

  getDuration(): number {
    return this.player?.duration() ?? 0;
  }

  setVolume(volume: number): void {
    if (this.isCpeMode()) {
      return;
    }
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.player?.volume(clampedVolume);
  }

  getVolume(): number {
    return this.player?.volume() ?? 1;
  }

  mute(): void {
    if (this.isCpeMode()) {
      return;
    }
    this.player?.muted(true);
  }

  unmute(): void {
    if (this.isCpeMode()) {
      return;
    }
    this.player?.muted(false);
  }

  toggleMute(): void {
    if (this.isCpeMode()) {
      return;
    }
    this.player?.muted(!this.player.muted());
  }

  isMuted(): boolean {
    return this.player?.muted() ?? false;
  }

  setPlaybackRate(rate: number): void {
    if (this.isCpeMode()) {
      return;
    }
    this.player?.playbackRate(rate);
  }

  getPlaybackRate(): number {
    return this.player?.playbackRate() ?? 1;
  }

  setProgressBarVisibility(_visible: boolean): void {
    // No-op in custom UI mode — progress is controlled via template
  }

  getPlayerMode(): PlayerMode {
    return this.mode();
  }

  isControlEnabled(control: 'seek' | 'volume' | 'playbackRate' | 'play'): boolean {
    if (this.mode() === PlayerMode.CPE) {
      return control === 'play';
    }
    return true;
  }
}

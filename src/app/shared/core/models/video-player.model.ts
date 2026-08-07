/** Represents the current state of the video player */
export enum VideoState {
  READY = 'READY',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
  BUFFERING = 'BUFFERING',
  ERROR = 'ERROR',
}

/**
 * Player mode presets that define control visibility and behavior
 * - DEFAULT: All configured controls are enabled
 * - CPE: Only play/pause and fullscreen work; other controls are visible but disabled
 */
export enum PlayerMode {
  /** Standard mode with all controls enabled */
  DEFAULT = 'DEFAULT',
  /** CPE mode: Only play/pause and fullscreen toggle are functional; others are disabled but visible */
  CPE = 'CPE',
}

/** Video source configuration */
export interface VideoSource {
  /** MIME type of the video (e.g., 'video/mp4', 'video/youtube', 'application/x-mpegURL') */
  type: string;
  /** URL or path to the video source */
  src: string;
}

/** Control bar configuration options */
export interface ControlBarConfig {
  /** Show/hide play toggle button */
  playToggle?: boolean;
  /** Show/hide volume panel */
  volumePanel?: boolean;
  /** Show/hide current time display */
  currentTimeDisplay?: boolean;
  /** Show/hide time divider */
  timeDivider?: boolean;
  /** Show/hide duration display */
  durationDisplay?: boolean;
  /** Show/hide progress control */
  progressControl?: boolean;
  /** Show/hide remaining time display */
  remainingTimeDisplay?: boolean;
  /** Show/hide fullscreen toggle */
  fullscreenToggle?: boolean;
  /** Show/hide picture-in-picture toggle */
  pictureInPictureToggle?: boolean;
  /** Show/hide playback rate menu button */
  playbackRatesMenuButton?: boolean;
}

/** YouTube-specific configuration options */
export interface YouTubeConfig {
  /** Show related videos (0 = no, 1 = yes) */
  rel?: 0 | 1;
  /** Use modest branding (0 = no, 1 = yes) */
  modestbranding?: 0 | 1;
  /** Show controls (0 = no, 1 = yes) */
  controls?: 0 | 1;
  /** Load closed captions policy */
  cc_load_policy?: 0 | 1;
  /** Preferred language for closed captions */
  cc_lang_pref?: string;
}

/** HLS/VHS (Video.js HTTP Streaming) configuration options */
export interface HlsConfig {
  /** Enable smooth quality switching */
  smoothQualityChange?: boolean;
  /** Override native HLS support (recommended for consistent behavior) */
  overrideNative?: boolean;
  /** Use device pixel ratio for quality selection */
  useDevicePixelRatio?: boolean;
  /** Enable low initial playlist for faster start */
  enableLowInitialPlaylist?: boolean;
  /** Bandwidth estimate (bytes per second) - used for initial quality selection */
  bandwidth?: number;
  /** Allow seeking to the end of the stream */
  allowSeeksWithinUnsafeLiveWindow?: boolean;
  /** Max buffer length in seconds */
  maxBufferLength?: number;
}

/** Main video player configuration */
export interface VideoConfig {
  /** Show player controls */
  controls?: boolean;
  /** Auto-play video on load */
  autoplay?: boolean;
  /** Loop video playback */
  loop?: boolean;
  /** Enable full-screen on ready */
  fullScreenOnReady?: boolean;
  /** Preload strategy */
  preload?: 'auto' | 'metadata' | 'none';
  /** Make player responsive (fluid) */
  fluid?: boolean;
  /** Enable responsive mode */
  responsive?: boolean;
  /** Mute video */
  muted?: boolean;
  /** Poster image URL (shown while loading or before play) */
  poster?: string;
  /** Technology order for playback - auto-detected based on source if not specified */
  techOrder?: ('youtube' | 'html5')[];
  /** Control bar configuration */
  controlBar?: ControlBarConfig;
  /** YouTube-specific options */
  youtube?: YouTubeConfig;
  /** HLS/VHS streaming options (for .m3u8 sources) */
  hls?: HlsConfig;
}

/** Video player error event data */
export interface VideoErrorEvent {
  code: number;
  message: string;
}

/** Video metadata event data */
export interface VideoMetadataEvent {
  duration: number;
}

/** Video time update event data */
export interface VideoTimeUpdateEvent {
  currentTime: number;
  duration: number;
}

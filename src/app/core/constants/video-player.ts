import {
  ControlBarConfig,
  HlsConfig,
  VideoConfig,
  YouTubeConfig,
} from '../models/video-player.model';

/** Default control bar configuration */
export const DEFAULT_CONTROL_BAR: Required<ControlBarConfig> = {
  playToggle: true,
  volumePanel: true,
  currentTimeDisplay: true,
  timeDivider: true,
  durationDisplay: true,
  progressControl: true,
  remainingTimeDisplay: true,
  fullscreenToggle: true,
  pictureInPictureToggle: false,
  playbackRatesMenuButton: true,
};

/** CPE mode control bar - all controls visible for display */
export const CPE_CONTROL_BAR: Required<ControlBarConfig> = {
  playToggle: true,
  volumePanel: true,
  currentTimeDisplay: true,
  timeDivider: true,
  durationDisplay: true,
  progressControl: false,
  remainingTimeDisplay: true,
  fullscreenToggle: true,
  pictureInPictureToggle: false,
  playbackRatesMenuButton: false,
};

/** Default YouTube configuration */
export const DEFAULT_YOUTUBE_CONFIG: Required<YouTubeConfig> = {
  rel: 0,
  modestbranding: 0,
  controls: 0,
  cc_load_policy: 1,
  cc_lang_pref: 'en',
};

/** Default HLS/VHS streaming configuration */
export const DEFAULT_HLS_CONFIG: Required<HlsConfig> = {
  smoothQualityChange: true,
  overrideNative: true,
  useDevicePixelRatio: true,
  enableLowInitialPlaylist: true,
  bandwidth: 5000000, // 5 Mbps initial estimate
  allowSeeksWithinUnsafeLiveWindow: true,
  maxBufferLength: 30,
};

/** Default video configuration */
export const DEFAULT_VIDEO_CONFIG: VideoConfig = {
  controls: true,
  autoplay: false,
  loop: false,
  fullScreenOnReady: false,
  preload: 'metadata',
  fluid: true,
  responsive: true,
  muted: false,
  // techOrder is auto-detected based on source type if not specified
  controlBar: DEFAULT_CONTROL_BAR,
  youtube: DEFAULT_YOUTUBE_CONFIG,
  hls: DEFAULT_HLS_CONFIG,
};

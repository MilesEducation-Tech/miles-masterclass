import { VideoConfig } from '@core/models/video-player.model';
import { PartnerContentItem } from '@shared/components/partner-content-list/partner-content-list';

/**
 * How long the course hero shows its poster before the trailer starts, as on
 * production and in the shared `VideoPoster`.
 */
export const HERO_TRAILER_DELAY_MS = 3000;

/**
 * The course hero's background trailer: an HLS stream, so it plays through the
 * shared video.js player rather than a plain `<video>`. Muted and looping with
 * no chrome; the hero draws its own play/pause and mute buttons.
 */
export const HERO_TRAILER_CONFIG: VideoConfig = {
  controls: false,
  autoplay: true,
  muted: true,
  loop: true,
  preload: 'auto',
  fluid: false,
  responsive: false,
};

/** The heading over the Coming Soon rail, styled as the micro-learning page's. */
export const MASTERCLASS_COMING_SOON_HEADING: PartnerContentItem[] = [
  {
    subHeading: 'Coming Soon on Masterclasses',
    paragraph: 'Hit the bell icon for updates and never miss a new CPE course drop!',
    subHeadingClass: 'text-white md:text-5xl text-3xl font-bold',
    itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto leading-relaxed',
    paragraphClass: 'text-white md:text-lg text-base font-normal mt-2',
  },
];

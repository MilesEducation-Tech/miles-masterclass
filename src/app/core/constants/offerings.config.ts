import type { Type } from '@angular/core';
import {
  matMicNoneOutline,
  matPhoneIphoneOutline,
  matPlayArrowOutline,
  matScienceOutline,
  matVideoCameraFrontOutline,
} from '@ng-icons/material-icons/outline';
import { environment } from '@env/environment';
import { HERO_FALLBACK_FEED, type HeroReelItem } from '@core/models/hero-reel-item.model';

export interface FloatingAsset {
  id: number;
  name: string;
  media: string | Type<unknown>;
  mediaType: 'image' | 'video' | 'component';
  animationName: string | null;
  position: {
    x: number;
    y: number;
    z: number;
    width?: number;
    height?: number;
  };
}

export type OfferingMockType = 'laptop' | 'phone';

export interface OfferingData {
  id: number;
  service: string;
  title: string;
  description: string;
  media: string;
  mediaType: 'image' | 'video';
  comingSoon?: boolean;
  animation: boolean;
  icon: string;
  mockType?: OfferingMockType;
  phoneFeed?: HeroReelItem[];
  floatingAssets: FloatingAsset[];
}

export const DEFAULT_OFFERINGS: OfferingData[] = [
  {
    id: 1,
    service: 'Masterclass',
    title: 'Hollywood-Style Master Classes',
    description: 'Cinematic, expert-led sessions that make AI concepts clear and actionable.',
    media: environment.GCS_URL + 'features/masterclassHome.mp4',
    icon: matPlayArrowOutline,
    mediaType: 'video',
    animation: true,
    mockType: 'laptop',
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/masterclass-nasba.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 30 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/masterclass-instructor.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 30 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/masterclass-topic.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
  {
    id: 4,
    service: 'Virtual Premieres',
    title: 'Live Premieres',
    description:
      'Get early access to new AI content. Join live sessions led by master instructors every Friday evening',
    media: environment.GCS_URL + 'features/premiereHome.mp4',
    icon: matVideoCameraFrontOutline,
    mediaType: 'video',
    animation: true,
    mockType: 'laptop',
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/premiere-live.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 15 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/PoolQuestions.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 20 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/premiere.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
  {
    id: 2,
    service: 'Podcasts',
    title: 'Insightful Podcasts',
    description:
      'Focused audio learning for busy professionals. Earn credits for qualifying episodes.',
    media: environment.GCS_URL + 'features/podcastHome.mp4',
    icon: matMicNoneOutline,
    mediaType: 'video',
    animation: true,
    comingSoon: false,
    mockType: 'laptop',
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/podcast-record.webp',
        mediaType: 'image',
        position: { x: 70, y: 10, z: 0, width: 40 },
        animationName: 'slideLeft',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/podcast-microphone.webp',
        mediaType: 'image',
        position: { x: -10, y: 5, z: 0, width: 40 },
        animationName: 'slideRight',
      },
    ],
  },
  {
    id: 3,
    service: 'Micro Learning',
    title: 'Reels for Micro-Learning*',
    description:
      'Short, targeted AI lessons designed for quick learning. Perfect for busy schedules.',
    media: environment.GCS_URL + 'features/nanoLearningHome.mp4',
    icon: matPhoneIphoneOutline,
    mediaType: 'video',
    animation: true,
    comingSoon: false,
    mockType: 'phone',
    phoneFeed: HERO_FALLBACK_FEED,
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/nano-stuff.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 30 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/nano-learn.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 30 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/nano-watch.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
];
export const PARTNER_OFFERINGS: OfferingData[] = [
  {
    id: 1,
    service: 'Masterclass',
    title: 'Hollywood-Style Master Classes',
    description: 'Cinematic, expert-led sessions that make AI concepts clear and actionable.',
    media: environment.GCS_URL + 'features/masterclassHome.mp4',
    icon: matPlayArrowOutline,
    mediaType: 'video',
    animation: true,
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/masterclass-nasba.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 30 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/masterclass-instructor.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 30 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/masterclass-topic.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
  {
    id: 2,
    service: 'Micro Learning',
    title: 'Reels for Micro-Learning',
    description:
      'Short, targeted AI lessons designed for quick learning. Perfect for busy schedules.',
    media: environment.GCS_URL + 'features/nanoLearningHome.mp4',
    icon: matVideoCameraFrontOutline,
    mediaType: 'video',
    animation: true,
    comingSoon: false,
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/nano-stuff.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 30 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/nano-learn.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 30 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/nano-watch.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
  {
    id: 3,
    service: 'Podcasts',
    title: 'Insightful Podcasts',
    description:
      'Focused audio learning for busy professionals. Earn credits for qualifying episodes.',
    media: environment.GCS_URL + 'features/podcastHome.mp4',
    icon: matMicNoneOutline,
    mediaType: 'video',
    animation: true,
    comingSoon: false,
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/podcast-record.webp',
        mediaType: 'image',
        position: { x: 70, y: 10, z: 0, width: 40 },
        animationName: 'slideLeft',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/podcast-microphone.webp',
        mediaType: 'image',
        position: { x: -10, y: 5, z: 0, width: 40 },
        animationName: 'slideRight',
      },
    ],
  },
  {
    id: 4,
    service: 'Gamified Learning',
    title: 'Gamified Learning',
    description: 'One skill. Seven days. Streaks and challenges designed to make CPE engaging.',
    media: environment.S3_BUCKET_URL + 'static-assests/web-app/partners/7-days-challenge.webp',
    icon: matPhoneIphoneOutline,
    mediaType: 'image',
    animation: true,
    comingSoon: false,
    mockType: 'phone',
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.S3_BUCKET_URL + 'static-assests/web-app/partners/start-challenge.webp',
        mediaType: 'image',
        position: { x: 80, y: 60, z: 1, width: 60 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.S3_BUCKET_URL + 'static-assests/web-app/partners/life.webp',
        mediaType: 'image',
        position: { x: 80, y: 0, z: 1, width: 23 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media:
          environment.S3_BUCKET_URL + 'static-assests/web-app/partners/7-days-challenge-text.webp',
        mediaType: 'image',
        position: { x: -20, y: 10, z: 1, width: 70 },
        animationName: 'floatInitSlide',
      },
    ],
  },
];
export const MGI_PARTNER_OFFERINGS: OfferingData[] = [
  {
    id: 1,
    service: 'Masterclass',
    title: 'Master Classes',
    description: 'Cinematic, expert-led sessions on real-world AI applications.',
    media: environment.GCS_URL + 'features/masterclassHome.mp4',
    icon: matPlayArrowOutline,
    mediaType: 'video',
    animation: true,
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/masterclass-nasba.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 30 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/masterclass-instructor.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 30 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/masterclass-topic.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
  {
    id: 2,
    service: 'Micro Learning',
    title: 'Micro-Learning',
    description: 'Instagram-style reels for 10-minute daily skill-building.',
    media: environment.GCS_URL + 'features/nanoLearningHome.mp4',
    icon: matVideoCameraFrontOutline,
    mediaType: 'video',
    animation: true,
    comingSoon: false,
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/nano-stuff.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 30 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/nano-learn.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 30 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/nano-watch.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
  {
    id: 3,
    service: 'Podcasts',
    title: 'Podcasts',
    description: 'Sharp conversations on AI strategy and firm leadership.',
    media: environment.GCS_URL + 'features/podcastHome.mp4',
    icon: matMicNoneOutline,
    mediaType: 'video',
    animation: true,
    comingSoon: false,
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/podcast-record.webp',
        mediaType: 'image',
        position: { x: 70, y: 10, z: 0, width: 40 },
        animationName: 'slideLeft',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/podcast-microphone.webp',
        mediaType: 'image',
        position: { x: -10, y: 5, z: 0, width: 40 },
        animationName: 'slideRight',
      },
    ],
  },

  {
    id: 4,
    service: 'Virtual Premieres',
    title: 'Live Webinars',
    description: 'Interactive, hands-on sessions across the full AI stack, with live Q&A.',
    media: environment.GCS_URL + 'features/premiereHome.mp4',
    icon: matVideoCameraFrontOutline,
    mediaType: 'video',
    animation: true,
    mockType: 'laptop',
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/premiere-live.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 15 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/PoolQuestions.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 20 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/premiere.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
];

/**
 * CPA Canada only. Order, headings and copy come from the CPA Canada
 * marketing deck: Master Classes → AI Labs → Micro-Learning → Podcasts →
 * Live Webinars, with Gamified Learning dropped. Kept as its own const so
 * this lineup can move without touching the other partner pages.
 */
export const CPA_CANADA_OFFERINGS: OfferingData[] = [
  {
    id: 1,
    service: 'Masterclass',
    title: 'Master Classes',
    description: 'Cinematic, expert-led sessions on real-world AI applications.',
    media: environment.GCS_URL + 'features/masterclassHome.mp4',
    icon: matPlayArrowOutline,
    mediaType: 'video',
    animation: true,
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/masterclass-nasba.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 30 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/masterclass-instructor.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 30 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/masterclass-topic.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
  {
    id: 2,
    service: 'AI Labs',
    title: 'AI Labs',
    description: "The world's first AI Labs for accountants, powered by Microsoft.",
    // Supplied direct from the milesmasterclass-assets bucket, not the GCS
    // path the other offering videos use. NOTE: QuickTime (.mov) at 3590x2012
    // / 63 MB — it decodes in Chrome and Safari but Firefox does not play
    // video/quicktime, and it is ~12x the size of the other offering clips.
    // Re-encode to MP4 at ~1280px wide when there's a moment.
    media: 'https://milesmasterclass-assets.s3.us-west-1.amazonaws.com/AI_Lab+_Video.mov',
    icon: matScienceOutline,
    mediaType: 'video',
    animation: true,
    comingSoon: false,
    mockType: 'laptop',
    // No floating assets — the video carries the whole story on this card.
    floatingAssets: [],
  },
  {
    id: 3,
    service: 'Micro Learning',
    title: 'Micro-Learning',
    description: 'Instagram-style reels for 10-minute daily skill-building.',
    media: environment.GCS_URL + 'features/nanoLearningHome.mp4',
    icon: matVideoCameraFrontOutline,
    mediaType: 'video',
    animation: true,
    comingSoon: false,
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/nano-stuff.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 30 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/nano-learn.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 30 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/nano-watch.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
  {
    id: 4,
    service: 'Podcasts',
    title: 'Podcasts',
    description: 'Sharp conversations on AI strategy and firm leadership.',
    media: environment.GCS_URL + 'features/podcastHome.mp4',
    icon: matMicNoneOutline,
    mediaType: 'video',
    animation: true,
    comingSoon: false,
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/podcast-record.webp',
        mediaType: 'image',
        position: { x: 70, y: 10, z: 0, width: 40 },
        animationName: 'slideLeft',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/podcast-microphone.webp',
        mediaType: 'image',
        position: { x: -10, y: 5, z: 0, width: 40 },
        animationName: 'slideRight',
      },
    ],
  },
  {
    id: 5,
    service: 'Virtual Premieres',
    title: 'Live Webinars',
    description: 'Interactive, hands-on sessions across the full AI stack, with live Q&A.',
    media: environment.GCS_URL + 'features/premiereHome.mp4',
    icon: matVideoCameraFrontOutline,
    mediaType: 'video',
    animation: true,
    mockType: 'laptop',
    floatingAssets: [
      {
        id: 1,
        name: 'Floating Asset 1',
        media: environment.GCS_URL + 'home/premiere-live.webp',
        mediaType: 'image',
        position: { x: 0, y: 5, z: 1, width: 15 },
        animationName: 'floatInit',
      },
      {
        id: 2,
        name: 'Floating Asset 2',
        media: environment.GCS_URL + 'home/PoolQuestions.webp',
        mediaType: 'image',
        position: { x: 80, y: 50, z: 1, width: 20 },
        animationName: 'floatInitBounce',
      },
      {
        id: 3,
        name: 'Floating Asset 3',
        media: environment.GCS_URL + 'home/premiere.webp',
        mediaType: 'image',
        position: { x: -10, y: 40, z: 1, width: 30 },
        animationName: 'floatInitSlide',
      },
    ],
  },
];

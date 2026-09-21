/**
 * Swiper configuration presets for carousel components.
 * Used across feature pages like masterclass, home, etc.
 */

export interface SwiperBreakpointConfig {
  slidesPerView: number;
  spaceBetween: number;
}

export interface SwiperConfig {
  rewind: boolean;
  slidesPerView: number;
  spaceBetween: number;
  breakpoints: Record<string, SwiperBreakpointConfig>;
}

/**
 * Configuration for carousels displaying larger cards (2-3 per view)
 * Used for: Coming Soon, In Progress, Completed sections
 */
export const swiperConfigEven: SwiperConfig = {
  rewind: true,
  slidesPerView: 2.8,
  spaceBetween: 30,
  breakpoints: {
    '320': {
      slidesPerView: 1.1,
      spaceBetween: 30,
    },
    '768': {
      slidesPerView: 2,
      spaceBetween: 30,
    },
    '1024': {
      slidesPerView: 2.8,
      spaceBetween: 30,
    },
  },
};

/**
 * Configuration for carousels displaying smaller cards (4-5 per view)
 * Used for: Track content items, Instructors
 */
export const swiperConfigOdd: SwiperConfig = {
  rewind: true,
  slidesPerView: 4.5,
  spaceBetween: 30,
  breakpoints: {
    '320': {
      slidesPerView: 1.5,
      spaceBetween: 30,
    },
    '768': {
      slidesPerView: 3,
      spaceBetween: 30,
    },
    '1024': {
      slidesPerView: 4.5,
      spaceBetween: 30,
    },
  },
};
export const swiperConfigComingSoon: SwiperConfig = {
  rewind: true,
  slidesPerView: 3.2,
  spaceBetween: 30,
  breakpoints: {
    '320': {
      slidesPerView: 1,
      spaceBetween: 30,
    },
    '768': {
      slidesPerView: 2,
      spaceBetween: 30,
    },
    '1024': {
      slidesPerView: 3.2,
      spaceBetween: 30,
    },
  },
};
export const swiperConfigPodcast: SwiperConfig = {
  rewind: true,
  slidesPerView: 5,
  spaceBetween: 30,
  breakpoints: {
    '320': {
      slidesPerView: 1,
      spaceBetween: 30,
    },
    '768': {
      slidesPerView: 3,
      spaceBetween: 30,
    },
    '1024': {
      slidesPerView: 5,
      spaceBetween: 30,
    },
  },
};

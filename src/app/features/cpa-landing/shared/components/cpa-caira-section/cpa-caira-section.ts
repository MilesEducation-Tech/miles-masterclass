import { Component, signal } from '@angular/core';

import { Carousel } from '../../../../../shared/components/carousel/carousel';
import { Horizontal } from '../../../../../shared/components/cards/horizontal/horizontal';
import { swiperConfigEven } from '../../../../../shared/core/config/swiper.config';

/**
 * CAIRA section of the CPA landing page.
 *
 * Renders active learning-track content in the shared `app-carousel` (Swiper),
 * sourced from the `Tracks` service. `Tracks` is provided at the
 * `DynamicLayout` route in `features.ts`, so it's injectable here without a
 * local provider.
 *
 * `getActiveTracksWithContentPreview()` fetches the first content page per
 * active track; we flatten those into `Content` cards. To scope the section to
 * a single CAIRA track instead, swap in `tracks.getTrackContent(cairaTrackId)`.
 */
@Component({
  selector: 'app-cpa-caira-section',
  imports: [Carousel, Horizontal],
  templateUrl: './cpa-caira-section.html',
  styleUrl: './cpa-caira-section.css',
})
export class CpaCairaSection {
  // ponytail: Tracks was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  protected readonly swiperConfigEven = swiperConfigEven;

  /**
   * Flattened first-page content across all active tracks.
   *
   * ponytail: was fed by `Tracks.getActiveTracksWithContentPreview()`, which
   * went with the backend. Point this signal at the new backend's track preview
   * and the carousel renders unchanged.
   */
  protected readonly cards = signal<any[]>([]);
}

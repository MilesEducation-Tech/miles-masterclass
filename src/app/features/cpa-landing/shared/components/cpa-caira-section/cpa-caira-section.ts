import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { Carousel } from '@shared/components/carousel/carousel';
import { Horizontal } from '@shared/components/cards/horizontal/horizontal';
import { swiperConfigEven } from '@core/config/swiper.config';
import { Content } from '@core/models/course.model';
import { Tracks } from '@features/shared/services/tracks/tracks';

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
  private readonly tracks = inject(Tracks);

  protected readonly swiperConfigEven = swiperConfigEven;

  /** Flattened first-page content across all active tracks. */
  protected readonly cards = toSignal(
    this.tracks
      .getActiveTracksWithContentPreview('masterclass')
      .pipe(map((tracks) => tracks.flatMap((track) => track.content))),
    { initialValue: [] as Content[] },
  );
}

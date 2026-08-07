import { Component, signal } from '@angular/core';

import { Carousel } from '../../../../../shared/components/carousel/carousel';
import { Horizontal } from '../../../../../shared/components/cards/horizontal/horizontal';
import { swiperConfigEven } from '../../../../../shared/core/config/swiper.config';

/**
 * "CAIRA Levels 1/2/3" section. Renders one `app-carousel` per CAIRA level,
 * with cards sourced from the course library via `UaeCairaFacade` (which is
 * provided at the UAE CAIRA route). Each card is the shared `app-horizontal`
 * masterclass card.
 */
@Component({
  selector: 'app-caira-levels-section',
  imports: [Carousel, Horizontal],
  templateUrl: './caira-levels-section.html',
  styleUrl: './caira-levels-section.css',
})
export class CairaLevelsSection {
  // ponytail: UaeCairaFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  protected readonly facade: any = {
    levels: signal<any[]>([]),
  };
  protected readonly swiperConfigEven = swiperConfigEven;
}

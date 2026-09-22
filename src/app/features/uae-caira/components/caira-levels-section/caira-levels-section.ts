import { Component, inject } from '@angular/core';

import { Carousel } from '@shared/components/carousel/carousel';
import { Horizontal } from '@shared/components/cards/horizontal/horizontal';
import { swiperConfigEven } from '@core/config/swiper.config';
import { UaeCairaFacade } from '../../services/uae-caira-facade';

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
  protected readonly facade = inject(UaeCairaFacade);
  protected readonly swiperConfigEven = swiperConfigEven;
}

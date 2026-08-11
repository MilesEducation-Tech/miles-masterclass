import { isPlatformBrowser } from '@angular/common';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  ViewChild,
  inject,
  input,
  output,
} from '@angular/core';
import { BadgeHeroCardData } from '../../mappers/badge-to-table';
import { Swiper, SwiperOptions } from 'swiper/types';
import { Navigation } from 'swiper/modules';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';
import { ensureSwiperElement } from '../../../../../shared/utils/swiper/ensure-swiper-element';
import { BadgeHeroCard } from '../../../../../shared/components/cards/badge-hero-card/badge-hero-card';
import { Button } from '../../../../../shared/components/ui/button/button';

type SwiperEl = HTMLElement & { swiper?: Swiper; initialize?: () => void };

@Component({
  selector: 'app-badge-swiper',
  imports: [BadgeHeroCard, Button, NgIcon],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight })],
  templateUrl: './badge-swiper.html',
  styleUrl: './badge-swiper.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'block w-full overflow-y-visible' },
})
export class BadgeSwiper {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private swiperEl: ElementRef<SwiperEl> | null = null;
  private initTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly badges = input.required<BadgeHeroCardData[]>();

  readonly claim = output<BadgeHeroCardData>();
  readonly share = output<BadgeHeroCardData>();
  readonly openInfo = output<void>();

  @ViewChild('swiperContainer')
  set swiperContainer(el: ElementRef<SwiperEl> | undefined) {
    if (!el || !this.isBrowser) return;
    this.swiperEl = el;
    if (this.initTimeoutId) clearTimeout(this.initTimeoutId);
    this.initTimeoutId = setTimeout(() => this.initSwiper(), 0);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.initTimeoutId) clearTimeout(this.initTimeoutId);
      this.initTimeoutId = null;
      this.swiperEl?.nativeElement?.swiper?.destroy(true, true);
      this.swiperEl = null;
    });
  }

  protected onClaim(badge: BadgeHeroCardData): void {
    this.claim.emit(badge);
  }

  protected onShare(badge: BadgeHeroCardData): void {
    this.share.emit(badge);
  }

  protected onOpenInfo(): void {
    this.openInfo.emit();
  }

  protected onPrev(): void {
    this.swiperEl?.nativeElement?.swiper?.slidePrev();
  }

  protected onNext(): void {
    this.swiperEl?.nativeElement?.swiper?.slideNext();
  }

  private async initSwiper(): Promise<void> {
    const el = this.swiperEl?.nativeElement;
    if (!el) return;

    // Register swiper's custom elements on demand, then bail if the component
    // was destroyed while the (one-time) import was in flight.
    await ensureSwiperElement();
    if (!this.swiperEl?.nativeElement) return;

    const params: SwiperOptions = {
      modules: [Navigation],
      slidesPerView: 1,
      loop: true,
      spaceBetween: 0,
    };
    Object.assign(el, params);
    el.initialize?.();
  }
}

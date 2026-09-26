import { Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { HeroReelItem } from '@core/models/hero-reel-item.model';
import { MicroLearningHeroReelCard } from '../micro-learning-hero-reel-card/micro-learning-hero-reel-card';

interface PhoneAction {
  icon: string;
  label: string;
}

export type PhoneMediaType = 'image' | 'video';

@Component({
  selector: 'app-micro-learning-hero-phone-mockup',
  imports: [MicroLearningHeroReelCard, NgOptimizedImage],
  templateUrl: './micro-learning-hero-phone-mockup.html',
  styleUrl: './micro-learning-hero-phone-mockup.css',
  host: { class: 'inline-flex' },
})
export class MicroLearningHeroPhoneMockup {
  readonly feedItems = input<HeroReelItem[]>([]);
  readonly media = input<string | null | undefined>(null);
  readonly mediaType = input<PhoneMediaType>('image');

  // Reels mode wins when a feed is provided — preserves the existing scrolling
  // animation for Micro-Learning. Media mode renders the offering's image/video
  // full-bleed inside the phone frame for other phone-type offerings.
  protected readonly showReels = computed(() => this.feedItems().length > 0);
  protected readonly showMedia = computed(() => !this.showReels() && !!this.media());

  // Doubled feed gives a seamless infinite scroll: animation translates 0 → -50%.
  // Each entry carries a precomputed display index so the template stays pipe-free.
  protected readonly loopFeed = computed(() => {
    const items = this.feedItems();
    if (!items.length) return [];
    const indexed = items.map((item, i) => ({
      item,
      indexLabel: String(i + 1).padStart(2, '0'),
    }));
    return [...indexed, ...indexed];
  });

  protected readonly actions: readonly PhoneAction[] = [
    { icon: '♥', label: '12.4k' },
    { icon: '◌', label: '842' },
    { icon: '↗', label: 'share' },
  ];
}

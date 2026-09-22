import { Component, output } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { MicroLearningHeroPhoneMockup } from '../micro-learning-hero-phone-mockup/micro-learning-hero-phone-mockup';
import { HERO_FALLBACK_FEED, HeroReelItem } from './hero-reel-item.model';

@Component({
  selector: 'app-micro-learning-hero',
  imports: [Button, MicroLearningHeroPhoneMockup],
  templateUrl: './micro-learning-hero.html',
  styleUrl: './micro-learning-hero.css',
})
export class MicroLearningHero {
  readonly startWatching = output<void>();
  readonly browseLibrary = output<void>();

  // Static promo deck. If the source ever needs to react to live data, swap
  // back to a `signal<HeroReelItem[]>` and wire it from the parent via input.
  protected readonly phoneFeed: HeroReelItem[] = HERO_FALLBACK_FEED;

  protected onStartWatching(): void {
    this.startWatching.emit();
  }

  protected onBrowseLibrary(): void {
    this.browseLibrary.emit();
  }
}

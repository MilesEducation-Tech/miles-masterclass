import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { HeroReelItem } from '../micro-learning-hero/hero-reel-item.model';

@Component({
  selector: 'app-micro-learning-hero-reel-card',
  imports: [NgOptimizedImage],
  templateUrl: './micro-learning-hero-reel-card.html',
  styleUrl: './micro-learning-hero-reel-card.css',
  host: {
    class: 'block w-full h-full relative',
  },
})
export class MicroLearningHeroReelCard {
  readonly item = input.required<HeroReelItem>();

  protected readonly variant = computed(() => this.item().variant);
  protected readonly progressWidth = computed(() => `${this.item().progress ?? 40}%`);
}

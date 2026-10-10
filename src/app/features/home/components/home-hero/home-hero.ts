import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Utils } from '@shared/services/utils';
import { HOME_ASSETS } from '../../constants/home-assets';
import { HomeHeroGrid } from '../home-hero-grid/home-hero-grid';

/**
 * The home hero (Figma "Home Page" `2175:21139`): the CAIRA credential pitch
 * over the tilted, scrolling grid of course thumbnails. Static copy, no API.
 * The CTAs are real links, so they are in the server HTML for crawlers.
 */
@Component({
  selector: 'app-home-hero',
  imports: [NgOptimizedImage, RouterLink, HomeHeroGrid],
  templateUrl: './home-hero.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeHero {
  private readonly utils = inject(Utils);

  protected readonly assets = HOME_ASSETS;

  private readonly localePrefix = computed(() => [
    '/',
    this.utils.country(),
    this.utils.profession(),
  ]);

  /** "Build your 1st AI agent, free" → the AI Labs landing (product decision). */
  protected readonly aiLabsLink = computed(() => [...this.localePrefix(), 'ai-labs']);
  protected readonly cairaLink = computed(() => [...this.localePrefix(), 'caira']);
}

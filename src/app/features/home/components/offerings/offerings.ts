import { Component, computed, DestroyRef, inject, input, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { NgIcon } from '@ng-icons/core';
import { Laptop } from './components/laptop/laptop';
import { FloatingAssets } from './components/floating-assets/floating-assets';
import { MicroLearningHeroPhoneMockup } from '../../../offerings/micro-learning/shared/components/micro-learning-hero-phone-mockup/micro-learning-hero-phone-mockup';
import type { HeroReelItem } from '../../../offerings/micro-learning/shared/components/micro-learning-hero/hero-reel-item.model';
import { DEFAULT_OFFERINGS, type OfferingData } from './offerings.config';

// Re-export so consumers (e.g. Laptop) can keep importing from '../../offerings'.
export type { OfferingData, FloatingAsset, OfferingMockType } from './offerings.config';

@Component({
  selector: 'app-offerings',
  imports: [Laptop, NgIcon, MicroLearningHeroPhoneMockup, FloatingAssets],
  templateUrl: './offerings.html',
  styleUrl: './offerings.scss',
})
export class Offering {
  private readonly platformId = inject(PLATFORM_ID);

  readonly offerings = input<OfferingData[]>(DEFAULT_OFFERINGS);
  readonly autoRotate = input<boolean>(true);
  readonly rotationIntervalMs = input<number>(15000);

  readonly selectedOfferingIndex = signal<number>(0);
  readonly isPaused = signal<boolean>(false);
  readonly selectedOffering = computed(() => this.offerings()[this.selectedOfferingIndex()]);
  // Stable empty array referenced from the template so OnPush doesn't see a new
  // identity each change-detection pass when an offering has no phoneFeed.
  protected readonly emptyFeed: HeroReelItem[] = [];

  private intervalSub: Subscription | null = null;

  constructor() {
    this.startAutoRotation();
    inject(DestroyRef).onDestroy(() => this.stopAutoRotation());
  }

  setOfferingIndex(index: number): void {
    if (index < 0 || index >= this.offerings().length) return;
    this.selectedOfferingIndex.set(index);
    this.restartAutoRotation();
  }

  pause(): void {
    if (this.isPaused()) return;
    this.isPaused.set(true);
    this.stopAutoRotation();
  }

  resume(): void {
    if (!this.isPaused()) return;
    this.isPaused.set(false);
    this.startAutoRotation();
  }

  private restartAutoRotation(): void {
    this.stopAutoRotation();
    this.startAutoRotation();
  }

  private startAutoRotation(): void {
    if (!isPlatformBrowser(this.platformId) || !this.autoRotate() || this.isPaused()) return;
    this.intervalSub = interval(this.rotationIntervalMs()).subscribe(() => {
      const next = (this.selectedOfferingIndex() + 1) % this.offerings().length;
      this.selectedOfferingIndex.set(next);
    });
  }

  private stopAutoRotation(): void {
    this.intervalSub?.unsubscribe();
    this.intervalSub = null;
  }
}

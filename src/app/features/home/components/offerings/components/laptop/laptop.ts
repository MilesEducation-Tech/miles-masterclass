import {
  Component,
  SimpleChanges,
  Renderer2,
  inject,
  input,
  signal,
  ElementRef,
  OnChanges,
  Type,
  PLATFORM_ID,
} from '@angular/core';
import { NgComponentOutlet, isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { OfferingData } from '../../offerings';

@Component({
  selector: 'app-laptop',
  imports: [NgComponentOutlet, NgOptimizedImage],
  templateUrl: './laptop.html',
  styleUrl: './laptop.css',
})
export class Laptop implements OnChanges {
  private platformId = inject(PLATFORM_ID);
  private renderer = inject(Renderer2);
  private elementRef = inject(ElementRef);

  offeringData = input<OfferingData | null>(null);
  offeringDataPrev = signal<OfferingData | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['offeringData'] &&
      changes['offeringData'].currentValue &&
      JSON.stringify(changes['offeringData'].currentValue) !==
        JSON.stringify(changes['offeringData'].previousValue)
    ) {
      // Step 1: If we have previous data, clean it up first
      if (this.offeringDataPrev()) {
        this.cleanupPreviousData();
      }

      // Step 2: Assign new offeringData to offeringDataPrev
      this.offeringDataPrev.set(this.offeringData());

      // Step 3: Start animation with new data
      this.resetAndStartAnimation();
    } else if (
      changes['offeringData'] &&
      changes['offeringData'].currentValue &&
      !this.offeringDataPrev()
    ) {
      // Initial load - just set the data without animation
      this.offeringDataPrev.set(this.offeringData());
    }
  }

  // Method to cleanup previous data styles and classes
  private cleanupPreviousData(): void {
    // Only perform DOM operations on client side
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const laptopElement = this.elementRef.nativeElement.querySelector('.laptop');
    if (laptopElement && this.offeringDataPrev()) {
      // Remove laptop classes
      this.renderer.removeClass(laptopElement, 'laptop--closed');
      this.renderer.removeClass(laptopElement, 'laptop--content-visible');

      const floatingAssets = laptopElement.querySelectorAll('.floatingAsset');
      floatingAssets.forEach((asset: Element, index: number) => {
        // Remove animation classes from previous data
        if (
          this.offeringDataPrev()?.floatingAssets &&
          this.offeringDataPrev()?.animation &&
          this.offeringDataPrev()?.floatingAssets[index]?.animationName
        ) {
          this.renderer.removeClass(
            asset,
            this.offeringDataPrev()?.floatingAssets[index].animationName!,
          );
        }

        // Reset styles to hidden state
        this.renderer.setStyle(asset, 'opacity', '0');
        this.renderer.setStyle(asset, 'visibility', 'hidden');
        this.renderer.setStyle(asset, 'transform', 'translateY(-70px) scale(0.8) rotate(-10deg)');
      });
    }
  }

  private resetLaptopState(): void {
    // Only perform DOM operations on client side
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const laptopElement = this.elementRef.nativeElement.querySelector('.laptop');
    if (laptopElement) {
      // Ensure laptop is in closed state for animation start
      this.renderer.addClass(laptopElement, 'laptop--closed');

      // Ensure all floating assets are hidden initially
      const floatingAssets = laptopElement.querySelectorAll('.floatingAsset');
      floatingAssets.forEach((asset: Element) => {
        this.renderer.setStyle(asset, 'opacity', '0');
        this.renderer.setStyle(asset, 'visibility', 'hidden');
        this.renderer.setStyle(asset, 'transform', 'translateY(-70px) scale(0.8) rotate(-10deg)');
      });
    }
  }

  private startAnimation(): void {
    // Only perform animations on client side
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const laptopElement = this.elementRef.nativeElement.querySelector('.laptop');
    if (laptopElement) {
      // Laptop is already in closed state from resetLaptopState
      // Start the sequential animations
      this.runSequentialAnimations();
    }
  }

  private runSequentialAnimations(): void {
    // Only run animations on client side
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Example of sequential animations
    const laptopElement = this.elementRef.nativeElement.querySelector('.laptop');

    if (laptopElement) {
      // First animation: laptop opens
      setTimeout(() => {
        this.renderer.removeClass(laptopElement, 'laptop--closed');
        // Assets remain hidden during laptop opening
      }, 500);

      // Second animation: content appears with staggered floating assets
      setTimeout(() => {
        this.renderer.addClass(laptopElement, 'laptop--content-visible');
        const floatingAssets = laptopElement.querySelectorAll('.floatingAsset');

        floatingAssets.forEach((asset: Element, index: number) => {
          // Add staggered delay for each asset
          setTimeout(() => {
            // Remove inline styles to let CSS take over
            this.renderer.removeStyle(asset, 'opacity');
            this.renderer.removeStyle(asset, 'visibility');
            this.renderer.removeStyle(asset, 'transform');

            // Add animation classes from current offeringDataPrev
            if (
              this.offeringDataPrev()?.floatingAssets &&
              this.offeringDataPrev()?.animation &&
              this.offeringDataPrev()?.floatingAssets[index]?.animationName
            ) {
              this.renderer.addClass(
                asset,
                this.offeringDataPrev()?.floatingAssets[index].animationName!,
              );
              this.renderer.setStyle(asset, 'animation-delay', `${index * 400}ms !important`);
            }
          }, index * 200); // 200ms delay between each asset
        });
      }, 1000);
    }
  }

  // Public method to reset and restart animation (if needed)
  resetAndStartAnimation(): void {
    // Only perform animation reset on client side
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.resetLaptopState();

    setTimeout(() => {
      this.startAnimation();
    }, 100);
  }

  // Type guard method to safely cast media to component type
  getComponentType(media: string | Type<any>): Type<any> | null {
    return typeof media === 'function' ? media : null;
  }
}

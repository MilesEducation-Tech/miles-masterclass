import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroStar } from '@ng-icons/heroicons/outline';
import { heroStarSolid } from '@ng-icons/heroicons/solid';

@Component({
  selector: 'app-rating-star',
  imports: [CommonModule, NgIcon],
  templateUrl: './rating-star.html',
  styleUrl: './rating-star.css',
  viewProviders: [provideIcons({ heroStar, heroStarSolid })],
  host: {
    class: 'w-full',
  },
})
export class RatingStar {
  value = input<number>(0);
  isReadonly = input<boolean>(false);
  max = input<number>(5);
  size = input<string>('1.5rem');
  containerClass = input<string>('flex items-center gap-1');
  starClass = input<string>('');

  valueChange = output<number>();

  stars = computed(() => {
    return Array(this.max())
      .fill(0)
      .map((_, i) => i + 1);
  });

  handleRate(rating: number) {
    if (this.isReadonly()) return;
    this.valueChange.emit(rating);
  }

  // Calculate clip path percentage for partial stars if needed
  // But CSS width overlay is easier.
  // We need to determine for each star if it is Full, Empty, or Partial.

  getStarState(index: number, value: number) {
    // index is 1-based (1..5)
    // value is e.g. 4.3
    if (value >= index) return 'full';
    if (value > index - 1) return 'partial'; // e.g. 4.3 > 4
    return 'empty';
  }

  getPartialPercent(index: number, value: number) {
    // index 5, value 4.3.
    // percent = (value - (index - 1)) * 100
    // (4.3 - 4) * 100 = 30%
    return Math.round((value - (index - 1)) * 100) + '%';
  }
}

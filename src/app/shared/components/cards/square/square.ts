import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';
import { CairaCredlyBadge } from '../caira-credly-badge/caira-credly-badge';

@Component({
  selector: 'app-square',
  imports: [NgOptimizedImage, CairaCredlyBadge],
  templateUrl: './square.html',
  host: {
    class: 'w-full relative aspect-square rounded-md block overflow-hidden',
  },
})
export class Square {
  thumbnail = input.required<string>();
  title = input<string>('');
  index = input.required<number>();
  includedForCaira = input<boolean>(false);
  hasIndividualBadge = input<boolean>(false);
  cairaLevel = input<number | null>(null);
}

import { Component } from '@angular/core';

@Component({
  selector: 'app-slider-skeleton',
  imports: [],
  templateUrl: './slider-skeleton.html',
  styleUrl: './slider-skeleton.css',
  host: {
    class: 'block relative w-full sm:aspect-video aspect-9/16 overflow-hidden',
    'aria-busy': 'true',
    'aria-live': 'polite',
    role: 'status',
  },
})
export class SliderSkeleton {}

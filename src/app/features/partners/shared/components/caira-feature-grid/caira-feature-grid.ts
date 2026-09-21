import { Component, input } from '@angular/core';

export interface CairaFeatureItem {
  title: string;
  /** Plain text or trusted HTML — rendered via `[innerHTML]` (Angular sanitizes). */
  description: string;
  image: string;
  imageAlt?: string;
}

@Component({
  selector: 'app-caira-feature-grid',
  imports: [],
  templateUrl: './caira-feature-grid.html',
  styleUrl: './caira-feature-grid.css',
})
export class CairaFeatureGrid {
  readonly items = input<CairaFeatureItem[]>([]);
}

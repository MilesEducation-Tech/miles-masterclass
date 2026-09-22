import { Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

export interface CairaStep {
  title: string;
  /** Plain text or trusted HTML — rendered via `[innerHTML]` (Angular sanitizes). */
  description: string;
  /** Raw SVG markup, fed to `<ng-icon [svg]>`. Use constants from `caira-step-icons.ts`. */
  icon: string;
  /** Optional accessible label; defaults to `title`. */
  iconLabel?: string;
}

@Component({
  selector: 'app-caira-steps-grid',
  imports: [NgIcon],
  templateUrl: './caira-steps-grid.html',
  styleUrl: './caira-steps-grid.css',
})
export class CairaStepsGrid {
  readonly steps = input<CairaStep[]>([]);
}

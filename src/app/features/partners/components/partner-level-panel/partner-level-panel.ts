import { Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

export interface PartnerLevelCard {
  /** Inline SVG markup. Use this OR `iconSrc`. */
  iconSvg?: string;
  /** External image URL. Use this OR `iconSvg`. */
  iconSrc?: string;
  iconAlt?: string;
  heading: string;
  paragraph: string;
}

@Component({
  selector: 'app-partner-level-panel',
  imports: [NgIcon],
  templateUrl: './partner-level-panel.html',
})
export class PartnerLevelPanel {
  readonly cards = input.required<readonly PartnerLevelCard[]>();
}

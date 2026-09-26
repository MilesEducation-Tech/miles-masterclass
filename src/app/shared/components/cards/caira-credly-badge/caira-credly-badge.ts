import { Component, computed, input } from '@angular/core';

const CAIRA_LOGO =
  'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/caira-logo-white.webp';
const CREDLY_LOGO =
  'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/credly.webp';

export type CairaCredlyBadgeVariant = 'overlay' | 'inline';

@Component({
  selector: 'app-caira-credly-badge',
  templateUrl: './caira-credly-badge.html',
})
export class CairaCredlyBadge {
  readonly includedForCaira = input.required<boolean>();
  readonly hasIndividualBadge = input.required<boolean>();
  readonly cairaLevel = input<number | null>(null);
  /** `overlay` (default) for dark glass pill on top of cards; `inline` for bordered pill matching hero CPE Credits style. */
  readonly variant = input<CairaCredlyBadgeVariant>('overlay');

  readonly cairaLogo = CAIRA_LOGO;
  readonly credlyLogo = CREDLY_LOGO;

  readonly showCaira = computed(() => this.includedForCaira() && this.cairaLevel() != null);
  readonly showCredly = computed(() => this.hasIndividualBadge());
  readonly showSeparator = computed(() => this.showCaira() && this.showCredly());
  readonly visible = computed(() => this.showCaira() || this.showCredly());
}

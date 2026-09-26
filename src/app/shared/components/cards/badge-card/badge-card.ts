import { Component, computed, input, output } from '@angular/core';
import { BadgeAction, BadgeCardButton, BadgeCardData } from '@core/models/badge.model';
import { badgeHaloHex } from '../../../utils/badge-level';
import { CategoriesList } from '../../categories-list/categories-list';
import { TotalCpeCreditsPipe } from '@shared/pipes/total-cpe-credits/total-cpe-credits-pipe';

export interface BadgeCardActionEvent {
  action: BadgeAction;
  card: BadgeCardData;
}

@Component({
  selector: 'app-badge-card',
  imports: [CategoriesList, TotalCpeCreditsPipe],
  templateUrl: './badge-card.html',
})
export class BadgeCard {
  readonly card = input.required<BadgeCardData>();
  readonly buttonAction = output<BadgeCardActionEvent>();

  readonly hasThumbnail = computed(() => !!this.card().thumbnailUrl);

  /** Hex color for the soft circular halo behind the badge icon, tinted by level. */
  readonly haloHex = computed(() => badgeHaloHex(this.card().levelRank));

  buttonClass(b: BadgeCardButton): string {
    const base =
      'w-max md:min-w-52 min-w-[45%] rounded-md px-4 py-3 text-sm font-medium transition-colors duration-200';
    switch (b.variant) {
      case 'primary':
        return `${base} bg-white hover:bg-white/90 text-black font-semibold`;
      case 'outline':
        return `${base} bg-transparent border-white/50 border-2 text-white font-semibold`;
      case 'disabled':
        return `${base} bg-white/40 text-black/60 cursor-not-allowed`;
    }
  }

  onButtonClick(b: BadgeCardButton) {
    if (b.variant === 'disabled') return;
    this.buttonAction.emit({ action: b.action, card: this.card() });
  }
}

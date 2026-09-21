import { NgClass, NgOptimizedImage } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { BadgeLevelItem } from '../../../core/models/badge.model';

@Component({
  selector: 'app-badge-level-card',
  imports: [NgOptimizedImage, NgClass],
  templateUrl: './badge-level-card.html',
  styleUrl: './badge-level-card.css',
})
export class BadgeLevelCard {
  readonly badge = input.required<BadgeLevelItem>();
  readonly cardClicked = output<BadgeLevelItem>();

  readonly statusLabel = computed(() => {
    const s = this.badge().status;
    if (s === 'earned') return 'Earned';
    if (s === 'unlocked') return 'Ready to claim';
    if (s === 'locked') return 'Locked';
    return s;
  });

  readonly statusTone = computed(() => {
    const s = this.badge().status;
    if (s === 'earned') return 'bg-green-500/15 text-green-400 border-green-500/30';
    if (s === 'unlocked') return 'bg-accent/15 text-accent border-accent/30';
    return 'bg-muted/30 text-muted-foreground border-border';
  });

  readonly progress = computed(() =>
    Math.min(100, Math.max(0, this.badge().progress_percentage ?? 0)),
  );

  readonly isComingSoon = computed(() => this.badge().badge.is_coming_soon);

  handleClick() {
    if (!this.isComingSoon()) {
      this.cardClicked.emit(this.badge());
    }
  }
}

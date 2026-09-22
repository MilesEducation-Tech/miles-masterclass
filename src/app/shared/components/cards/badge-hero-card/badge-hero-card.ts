import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLinkedin, lucideLock } from '@ng-icons/lucide';
import { BadgeItem } from '@core/models/cpe-tracker.model';
import { Button } from '../../../ui/button/button';
import {
  badgeHaloHex,
  badgeLevelGradient,
  badgeProgressGradient,
} from '../../../utils/badge-level';

export type BadgeHeroLayout = 'hero' | 'grid';

/**
 * Badge state machine. Order matters — `coming_soon` short-circuits everything,
 * then `claimed` (awarded_at set), then `claimable` (100% + no award), else
 * the wire-side `status`:
 *   - `unlocked` → in-progress, full-colour image with progress bar
 *   - `locked`   → gated, grayscale image with lock overlay
 */
export type BadgeState = 'coming_soon' | 'claimable' | 'claimed' | 'unlocked' | 'locked';

@Component({
  selector: 'app-badge-hero-card',
  imports: [Button, NgIcon],
  providers: [provideIcons({ lucideLinkedin, lucideLock })],
  templateUrl: './badge-hero-card.html',
  styleUrl: './badge-hero-card.css',
  host: { class: 'block w-full' },
})
export class BadgeHeroCard {
  readonly badge = input.required<BadgeItem>();
  readonly layout = input<BadgeHeroLayout>('hero');

  readonly claim = output<BadgeItem>();
  readonly share = output<BadgeItem>();

  protected readonly state = computed<BadgeState>(() => {
    const b = this.badge();
    if (b.status === 'locked') return 'locked';
    if (b.is_coming_soon) return 'coming_soon';
    if (b.is_claimed) return 'claimed';
    if (b.is_claimable) return 'claimable';
    return b.status;
  });

  protected readonly isHero = computed(() => this.layout() === 'hero');

  /** Split the legacy "Name — Level" join so the level renders separately. */
  protected readonly displayName = computed(() => this.badge().name.split(' — ')[0]);

  protected readonly levelGradient = computed(() => badgeLevelGradient(this.badge().level_rank));

  protected readonly progressGradient = computed(() =>
    badgeProgressGradient(this.badge().level_rank),
  );

  protected readonly haloHex = computed(() => badgeHaloHex(this.badge().level_rank));

  protected readonly progress = computed(() =>
    Math.min(100, Math.max(0, this.badge().progress_percentage ?? 0)),
  );

  protected onClaim(): void {
    this.claim.emit(this.badge());
  }

  protected onShare(): void {
    this.share.emit(this.badge());
  }
}

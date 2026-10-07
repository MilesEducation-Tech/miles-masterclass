import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { Utils } from '@shared/services/utils';
import { HOME_ASSETS } from '../../constants/home-assets';
import { HomePrice } from '../../models/home-sections.model';

/**
 * The pricing card (Figma 2175:26155): the plan's pitch, the figures, and the
 * way to the plan page. Presentational — the figures come in through `price`.
 *
 * API flag: the home page binds no `price` yet, so the figure block stays
 * hidden and the card shows the copy, the icon and the CTAs. v3 read
 * `v2/plans/`; this app waits for the web source of truth for plan prices
 * (prompts/home-redesign.md). The Storybook story shows the full card.
 */
@Component({
  selector: 'app-home-pricing',
  imports: [CurrencyPipe, NgIcon, NgOptimizedImage, RouterLink],
  templateUrl: './home-pricing.html',
  providers: [provideIcons({ lucideCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePricing {
  private readonly utils = inject(Utils);

  /** The figures to show; `null` hides the figure block (and nothing else). */
  readonly price = input<HomePrice | null>(null);

  protected readonly appIcon = HOME_ASSETS.pricingAppIcon;

  /** Design copy (Figma 2175:26155). Marketing, not the plan's `features[]`. */
  protected readonly included = [
    'Unlimited masterclasses, webinars, reels, podcasts and AI Challenges',
    '12 months of Miles AI Labs - Copilot Studio and Power Automate to build in, no licenses to buy',
    'NASBA-approved CPE credits, tracked and certified for you',
    'The CAIRA (Certified AI-Ready Accountant) credential. 3 Levels',
    'Credly badges to showcase on your LinkedIn profile',
  ];

  private readonly localePrefix = computed(() => [
    '/',
    this.utils.country(),
    this.utils.profession(),
  ]);

  protected readonly planLink = computed(() => [...this.localePrefix(), 'payment', 'plan']);
  protected readonly contactLink = computed(() => [...this.localePrefix(), 'connect-us']);
}

import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDownload } from '@ng-icons/lucide';
import { CpeLedger } from '@features/tracker/cpe/models/cpe-credit.model';
import { Button } from '@shared/ui/button/button';

/**
 * The blurb under the credits count. Two strings rather than one, because the
 * design's copy is CAIRA-specific and would read as nonsense on the Others
 * ledger, which has nothing to do with the CAIRA registry.
 */
const LEDGER_BLURB: Record<CpeLedger, string> = {
  caira:
    'Verification complete. Node active on CAIRA distributed ledger. Your badges are cryptographically signed and peer-verified.',
  others: 'CPE credits earned outside the CAIRA programme, counted toward your reporting cycle.',
};

/** Top-of-screen portfolio card — Figma `51200-36347`. */
@Component({
  selector: 'app-portfolio-summary',
  imports: [Button, DecimalPipe, NgIcon],
  providers: [provideIcons({ lucideDownload })],
  templateUrl: './portfolio-summary.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class PortfolioSummary {
  readonly creditsEarned = input.required<number>();
  readonly ledger = input.required<CpeLedger>();
  readonly isLoading = input(false);

  readonly viewCompliance = output<void>();
  readonly downloadNasba = output<void>();
  readonly downloadAll = output<void>();

  protected readonly blurb = computed(() => LEDGER_BLURB[this.ledger()]);
}

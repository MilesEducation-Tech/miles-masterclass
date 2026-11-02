import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { AiLabTokenBalance } from '@features/ai-labs/models/ai-labs.model';
import { tokenMeterVariant, tokenUsedPercent } from '@features/ai-labs/utils/token-usage';
import { Button } from '@shared/ui/button/button';
import { Progress } from '@shared/ui/progress/progress';

/**
 * The learner's Copilot Credits: how much they have left of their cap, and the way to ask for more.
 * One floating pill, meant for both the AI Labs landing page and a course page.
 *
 * **Presentational.** The source design injects a token service that owns the read, the request
 * dialog and the POST; here the balance arrives as an input and `topUp` is an output. `balance` is
 * the `tokens` object of `web-api/v1/ai-labs/tokens/` as sent, so wiring it up is passing that
 * field through and handling `topUp` — nothing in this file has to change.
 *
 * Self-gating: with no balance it renders nothing, so a host page can drop it in without an `@if`.
 * That is also the "is this a lab user at all" gate — a floating skeleton would be noise.
 */
@Component({
  selector: 'app-ai-lab-token-meter',
  imports: [Button, Progress, DecimalPipe],
  templateUrl: './ai-lab-token-meter.html',
  host: { class: 'block' },
})
export class AiLabTokenMeter {
  /** `null` means no allotment, which renders as nothing rather than a row of zeros. */
  readonly balance = input<AiLabTokenBalance | null>(null);

  /** A top-up request is in flight. */
  readonly submitting = input(false);

  /** The learner asked for more credits. The host owns the dialog and the request. */
  readonly topUp = output<void>();

  protected readonly usedPercent = computed(() => {
    const b = this.balance();
    return b ? tokenUsedPercent(b.cap, b.used) : 0;
  });

  protected readonly meterVariant = computed(() => tokenMeterVariant(this.usedPercent()));
}

import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { AiLabTokenBalance } from '@features/ai-labs/models/ai-labs.model';
import { tokenMeterVariant, tokenUsedPercent } from '@features/ai-labs/utils/token-usage';
import { Button } from '@shared/ui/button/button';
import { Progress } from '@shared/ui/progress/progress';

/**
 * The learner's AI Lab token allotment: how much they have, how much they've burned, and the way
 * to ask for more. One floating pill, meant for both the AI Labs landing page and a course page.
 *
 * **Presentational.** The source design injects a token service that owns the read, the request
 * dialog and the POST; here the balance arrives as an input and `topUp` is an output, because the
 * reads are not bound yet. Wiring it up is a matter of feeding `balance` and handling `topUp` —
 * nothing in this file has to change.
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

  /** The learner asked for more tokens. The host owns the dialog and the request. */
  readonly topUp = output<void>();

  protected readonly usedPercent = computed(() => {
    const b = this.balance();
    return b ? tokenUsedPercent(b.allotted, b.used) : 0;
  });

  protected readonly meterVariant = computed(() => tokenMeterVariant(this.usedPercent()));
}

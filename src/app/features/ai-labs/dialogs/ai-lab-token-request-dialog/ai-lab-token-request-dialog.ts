import { DecimalPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { injectDialogRef } from 'ng-primitives/dialog';
import { NgpDescription, NgpLabel } from 'ng-primitives/form-field';
import { AiLabTokenAddOn, AiLabTokenRequestBody } from '@features/ai-labs/models/ai-labs.model';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';
import { Field } from '@shared/ui/field/field';
import { Textarea } from '@shared/ui/textarea/textarea';

/** What the meter passes in, so the dialog can show the numbers it is topping up. */
export interface AiLabTokenRequestData {
  /** Decimal string, as the API sends it — displayed, never computed with. */
  remaining: string;
  cap: number;
}

/** A longer reason is refused by the backend's strict body — stop it here instead. */
const REASON_MAX = 500;

/** The two add-on sizes, with the blurb each one gets on its card. */
const OPTIONS: readonly { tokens: AiLabTokenAddOn; label: string; hint: string }[] = [
  {
    tokens: 500,
    label: '+500 credits',
    hint: 'Enough to finish a lab you are part-way through.',
  },
  {
    tokens: 1000,
    label: '+1,000 credits',
    hint: 'Room to build and re-run a full agent workflow.',
  },
];

/**
 * Ask for an add-on to the Copilot Credits cap.
 *
 * Consent-and-choice only: it closes with the body of `POST api/v1/ai-labs/tokens-request/`, and
 * the caller owns the POST. Same split as `AiLabTermsDialog` — keeping the request out of here
 * means the dialog has no error state of its own and no way to strand the meter's submitting flag.
 *
 * A learner may only have one open request at a time. That rule is the backend's (it answers 409
 * `tokens_request_open`); the meter simply doesn't offer this dialog while a request is pending,
 * so there is nothing to guard here.
 *
 * Opened from code by the page that owns the meter, so it lives in this feature's `dialogs/`.
 */
@Component({
  selector: 'app-ai-lab-token-request-dialog',
  imports: [Button, DecimalPipe, Dialog, Field, NgIcon, NgpDescription, NgpLabel, Textarea],
  providers: [provideIcons({ heroXMark })],
  templateUrl: './ai-lab-token-request-dialog.html',
})
export class AiLabTokenRequestDialog {
  /** Resolves with the request body, or undefined when the learner backs out. */
  protected readonly dialogRef = injectDialogRef<AiLabTokenRequestData, AiLabTokenRequestBody>();

  protected readonly data = this.dialogRef.data;
  protected readonly options = OPTIONS;

  protected readonly selected = signal<AiLabTokenAddOn | null>(null);
  protected readonly reason = signal('');

  protected readonly reasonMax = REASON_MAX;
  protected readonly reasonLength = computed(() => this.reason().trim().length);
  protected readonly reasonTooLong = computed(() => this.reasonLength() > REASON_MAX);

  protected readonly canSubmit = computed(() => this.selected() !== null && !this.reasonTooLong());

  protected typed(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected submit(): void {
    const tokens = this.selected();
    if (tokens === null || this.reasonTooLong()) return;
    const reason = this.reason().trim();
    this.dialogRef.close({ tokens, ...(reason ? { reason } : {}) });
  }
}

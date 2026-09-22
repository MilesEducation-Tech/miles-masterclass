import { Component, ElementRef, afterNextRender, signal, viewChild } from '@angular/core';
import { DialogRef } from '@core/services/dialog/dialog';
import { AriaInput } from '../../ui/aria/aria-input/aria-input';
import { Button } from '../../ui/button/button';
import { AI_LAB_AGREEMENT } from './ai-lab-terms-dialog.model';

/**
 * The Miles AI Labs participant agreement, gating account provisioning.
 *
 * Consent-only: it collects the ticks and closes with the result, and the caller
 * (`AiLabs.createAccount`) owns the POST. Keeping the request out of here means
 * the dialog has no error state to render and no way to leave the page's
 * `submitting` flag stranded.
 *
 * `UtilsDialog` isn't reusable for this — it has no checkbox, and no way to gate
 * its buttons on one.
 */
@Component({
  selector: 'app-ai-lab-terms-dialog',
  imports: [AriaInput, Button],
  templateUrl: './ai-lab-terms-dialog.html',
})
export class AiLabTermsDialog {
  /** Resolves `true` only when the user accepted; every other exit is undefined. */
  dialogRef!: DialogRef<AiLabTermsDialog, boolean>;

  protected readonly blocks = AI_LAB_AGREEMENT;

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  /**
   * Latches once the agreement has been scrolled to the end — the confirmations
   * stay disabled until then. One-way on purpose: scrolling back up doesn't
   * un-read the terms, and re-locking would just trap someone who nudged the
   * wheel.
   */
  protected readonly atBottom = signal(false);

  protected readonly accepted = signal<unknown>(false);

  constructor() {
    // A viewport tall enough to show the whole agreement never fires `scroll`,
    // which would leave the checkbox permanently disabled.
    afterNextRender(() => this.checkAtBottom(this.scroller().nativeElement));
  }

  protected checkAtBottom(el: HTMLElement): void {
    // 4px of slack: fractional layout heights mean `scrollTop` routinely stops a
    // sub-pixel short of the true maximum.
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 4) this.atBottom.set(true);
  }

  protected launch(): void {
    if (this.accepted() !== true) return;
    this.dialogRef.close(true);
  }
}

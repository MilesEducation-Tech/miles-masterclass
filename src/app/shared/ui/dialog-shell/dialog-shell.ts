import { Component, computed, effect, input } from '@angular/core';
import { NgpDialog, NgpDialogOverlay, injectDialogRef } from 'ng-primitives/dialog';
import { cn } from '../../utils/cn';

/**
 * The frame every dialog renders inside: backdrop + panel, built on ng-primitives.
 *
 * A dialog opened with `NgpDialogManager.open(Component)` is attached to <body> bare —
 * the manager supplies no container. Wrapping the dialog's template in this component
 * supplies the `ngpDialogOverlay` / `ngpDialog` pair that gives it role, aria-modal,
 * focus trap and restore, Escape and backdrop dismissal (topmost dialog only), the
 * exit-animation wait before removal, and the page's scroll lock.
 *
 * Size and placement are inputs because they used to be call-site config
 * (`maxWidth`, `position: 'right'`, …) on the hand-rolled `Dialog` service; each dialog
 * now owns the one presentation its call sites always passed.
 */
@Component({
  selector: 'app-dialog-shell',
  imports: [NgpDialog, NgpDialogOverlay],
  templateUrl: './dialog-shell.html',
  styleUrl: './dialog-shell.css',
})
export class DialogShell {
  private readonly dialogRef = injectDialogRef();

  readonly ariaLabel = input('Dialog');
  readonly width = input<string>();
  readonly maxWidth = input<string>();
  readonly height = input<string>();
  /** `right` renders a full-height drawer that slides in from the right edge. */
  readonly position = input<'center' | 'right'>('center');
  /** Extra classes for the panel, merged with `cn()` so callers can override. */
  readonly panelClass = input('');
  /** `false` ignores Escape and backdrop clicks — the old `disableClose: true`. */
  readonly dismissible = input(true);

  protected readonly overlayClasses = computed(() =>
    cn(
      'dialog-overlay fixed inset-0 z-1000 flex bg-black/60',
      this.position() === 'right' ? 'items-stretch justify-end' : 'items-center justify-center',
    ),
  );

  protected readonly panelClasses = computed(() =>
    cn(
      'bg-dialog text-dialog-foreground shadow-2xl overflow-auto outline-none',
      this.position() === 'right' ? 'dialog-drawer h-full' : 'dialog-panel rounded-lg max-h-[90vh]',
      this.panelClass(),
    ),
  );

  constructor() {
    // Escape is handled centrally by ng-primitives' overlay registry, which reads this flag;
    // the overlay's own click-to-close input covers the backdrop.
    effect(() => {
      this.dialogRef.disableClose = !this.dismissible();
    });
  }
}

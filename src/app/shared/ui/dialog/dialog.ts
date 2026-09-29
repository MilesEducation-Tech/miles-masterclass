import { ChangeDetectionStrategy, Component, computed, effect, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { NgpButton } from 'ng-primitives/button';
import {
  NgpDialog,
  NgpDialogDescription,
  NgpDialogOverlay,
  NgpDialogTitle,
  injectDialogRef,
  provideDialogState,
} from 'ng-primitives/dialog';
import { cn } from '../../utils/cn';

/** Where the panel sits: a centred modal, or a full-height drawer on the right. */
export type DialogPosition = 'center' | 'right';

const OVERLAY: Record<DialogPosition, string> = {
  center: 'items-center justify-center p-4',
  right: 'justify-end',
};

const PANEL_BASE =
  'relative flex flex-col overflow-y-auto bg-dialog text-dialog-foreground shadow-2xl outline-none motion-reduce:animate-none';

const PANEL: Record<DialogPosition, string> = {
  center:
    'max-h-[90svh] w-full max-w-lg rounded-xl p-6 animate-in fade-in-0 zoom-in-95 data-exit:animate-out data-exit:fade-out-0 data-exit:zoom-out-95',
  right:
    'h-full w-full max-w-[500px] animate-in slide-in-from-right data-exit:animate-out data-exit:slide-out-to-right',
};

/**
 * The frame every dialog renders inside. Open it through `NgpDialogManager.open(MyDialog)`;
 * `MyDialog`'s template wraps its content in `<app-dialog>` and reads `injectDialogRef()`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dialog',
  hostDirectives: [NgpDialogOverlay],
  imports: [NgpDialog, NgpDialogTitle, NgpDialogDescription, NgpButton, NgIcon],
  providers: [
    provideIcons({ heroXMark }),
    // We need to hoist the dialog state to the host component so that it can be used
    // within ng-content
    provideDialogState(),
  ],
  host: {
    '[class]': 'overlayClasses()',
  },
  template: `
    <div
      ngpDialog
      [class]="panelClasses()"
      [style.width]="width() ?? null"
      [style.max-width]="maxWidth() ?? null"
      [attr.aria-label]="header() ? null : ariaLabel()"
    >
      @if (header(); as header) {
        <h2 ngpDialogTitle class="text-lg leading-7 font-semibold">{{ header }}</h2>
      }
      @if (description(); as description) {
        <p ngpDialogDescription class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
      }
      @if (closable()) {
        <button
          ngpButton
          type="button"
          class="absolute top-3 right-3 z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none data-hover:bg-muted data-hover:text-foreground data-focus-visible:outline-2 data-focus-visible:outline-ring"
          aria-label="Close"
          (click)="dialogRef.close()"
        >
          <ng-icon name="heroXMark" aria-hidden="true" />
        </button>
      }
      <ng-content />
    </div>
  `,
})
export class Dialog {
  protected readonly dialogRef = injectDialogRef();

  /** The dialog title. Labels the dialog; when omitted, pass `ariaLabel` instead. */
  readonly header = input<string>();

  /** A short line under the title, announced as the dialog description. */
  readonly description = input<string>();

  /** Accessible name for dialogs that draw their own heading and pass no `header`. */
  readonly ariaLabel = input<string>();

  readonly position = input<DialogPosition>('center');

  /** Extra classes for the panel, e.g. a wider `max-w-*` or `p-0` for edge-to-edge content. */
  readonly panelClass = input('');

  /** Per-call panel sizes for dialogs configured at runtime; static sizes belong in `panelClass`. */
  readonly width = input<string>();
  readonly maxWidth = input<string>();

  /** `false` keeps the dialog open on Escape and on a backdrop click. */
  readonly dismissible = input(true);

  /** Renders a close button in the top-right corner. */
  readonly closable = input(false);

  protected readonly overlayClasses = computed(() =>
    cn(
      'fixed inset-0 z-1000 flex bg-black/60 backdrop-blur-sm animate-in fade-in-0 data-exit:animate-out data-exit:fade-out-0 motion-reduce:animate-none',
      OVERLAY[this.position()],
    ),
  );

  protected readonly panelClasses = computed(() =>
    cn(PANEL_BASE, PANEL[this.position()], this.panelClass()),
  );

  constructor() {
    effect(() => {
      this.dialogRef.disableClose = !this.dismissible();
    });
  }
}

import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matCloseRound } from '@ng-icons/material-icons/round';
import { ButtonSize, ButtonVariant } from '@core/models/button.model';
import { cn } from '../../../utils/cn';
import { NgpButton } from 'ng-primitives/button';

/**
 * Styled button wrapping the native element with `ngpButton`.
 *
 * The primitive is applied in the template rather than as a host directive: the
 * documented `button[app-button]` shape would move the button onto the host and
 * break all 431 `<app-button>` call sites for no visible gain. In template mode
 * it still contributes the hover/press/focus-visible handling and exposes them
 * as `data-*` attributes on the inner button.
 */
@Component({
  selector: 'app-button',
  imports: [NgIcon, NgpButton],
  templateUrl: './button.html',
  styleUrl: './button.css',
  providers: [provideIcons({ matCloseRound })],
})
export class Button {
  // Inputs
  variant = input<ButtonVariant>('default');
  size = input<ButtonSize>('default');
  disabled = input<boolean>(false);
  type = input<'button' | 'submit' | 'reset'>('button');
  /** Optional aria-label. The `close` variant hard-codes `'Close'`; for icon-only
   *  buttons in other variants, set this to keep them screen-reader friendly. */
  ariaLabel = input<string | null>(null);
  // Alias 'class' so users can use [class]="'my-class'" and it works as expected for merging.
  // eslint-disable-next-line @angular-eslint/no-input-rename -- intentional class merging
  userClass = input<string>('', { alias: 'class' });

  // Output
  clicked = output<MouseEvent>();

  // Check if this is a close variant
  protected readonly isCloseVariant = computed(() => this.variant() === 'close');

  protected readonly resolvedAriaLabel = computed(() =>
    this.isCloseVariant() ? 'Close' : this.ariaLabel(),
  );

  // Computed classes
  buttonClasses = computed(() => {
    const baseClasses =
      'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2  disabled:opacity-50 cursor-pointer';

    const variantClasses: Record<ButtonVariant, string> = {
      default: 'bg-white text-black hover:bg-white/90',
      primary: 'bg-primary text-white hover:bg-primary/90',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      outline: 'border border-border bg-transparent',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost: '',
      link: 'text-accent underline-offset-4 hover:underline',
      close:
        'bg-background/80 backdrop-blur-sm text-foreground ring-0 outline-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent active:ring-0 active:ring-offset-0 active:ring-transparent hover:bg-destructive hover:text-destructive-foreground rounded-full',
    };

    const sizeClasses: Record<ButtonSize, string> = {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 rounded-md px-3',
      lg: 'h-11 rounded-md px-8',
      icon: 'h-10 w-10',
      // Inline-link size: no padding/min-height so it sits naturally beside text.
      link: 'h-auto p-0',
    };

    // Close variant defaults to icon size
    const effectiveSize = this.variant() === 'close' ? 'icon' : this.size();

    return cn(
      baseClasses,
      variantClasses[this.variant()],
      sizeClasses[effectiveSize],
      this.userClass(),
      this.disabled() && 'cursor-not-allowed!',
    );
  });

  handleClick(event: MouseEvent): void {
    if (!this.disabled()) {
      this.clicked.emit(event);
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { NgpButton } from 'ng-primitives/button';
import { cn } from '../../utils/cn';

/**
 * The size of the button.
 */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

/**
 * The variant of the button.
 */
export type ButtonVariant =
  'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';

// `data-hover` / `data-press` / `data-focus-visible` come from ngpButton, so hover and press
// behave the same for mouse, touch and keyboard; `disabled:` is the native attribute the
// primitive reflects.
const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap outline-none transition-colors duration-200 motion-reduce:transition-none data-focus-visible:outline-2 data-focus-visible:outline-solid data-focus-visible:outline-offset-2 data-focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  // The design's main CTA: white on the dark page. `primary` is the blue accent button.
  default: 'bg-white text-black data-hover:bg-white/90 data-press:bg-white/80',
  primary: 'bg-primary text-primary-foreground data-hover:bg-primary/90 data-press:bg-primary/80',
  secondary:
    'bg-secondary text-secondary-foreground data-hover:bg-muted data-press:bg-secondary/80',
  destructive:
    'bg-destructive text-destructive-foreground data-hover:bg-destructive/90 data-press:bg-destructive/80',
  outline:
    'border border-border bg-transparent text-foreground data-hover:bg-muted data-press:bg-secondary',
  ghost: 'bg-transparent text-foreground data-hover:bg-muted data-press:bg-secondary',
  link: 'bg-transparent text-accent underline-offset-4 data-hover:underline data-press:text-accent/80',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
  xl: 'h-14 px-6 text-lg',
  icon: 'size-10 px-0',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'button[app-button]',
  hostDirectives: [{ directive: NgpButton, inputs: ['disabled'] }],
  template: `
    <ng-content select="[slot=leading]" />
    <ng-content />
    <ng-content select="[slot=trailing]" />
  `,
  host: {
    '[class]': 'classes()',
  },
})
export class Button {
  /**
   * The size of the button.
   */
  readonly size = input<ButtonSize>('md');

  /**
   * The variant of the button.
   */
  readonly variant = input<ButtonVariant>('default');

  // The element's own `class` attribute goes through cn() too, so a caller's `px-0` or `w-full`
  // wins over the size defaults instead of colliding with them.
  private readonly ownClass =
    inject(ElementRef<HTMLElement>).nativeElement.getAttribute('class') ?? '';

  protected readonly classes = computed(() =>
    cn(BASE, VARIANTS[this.variant()], SIZES[this.size()], this.ownClass),
  );
}

import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  EmbeddedViewRef,
  HostAttributeToken,
  inject,
  input,
  model,
  output,
  PLATFORM_ID,
  Renderer2,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import type { FormValueControl } from '@angular/forms/signals';
import { NgIcon } from '@ng-icons/core';
import { heroCheck, heroXMark } from '@ng-icons/heroicons/outline';
import {
  AutoCompleteCompleteEvent,
  AutoCompleteOption,
  AutoCompleteSelectEvent,
} from '@core/models/form.model';
import { cn } from '../../utils/cn';
import { Button } from '../button/button';
import { faSolidSpinner } from '@ng-icons/font-awesome/solid';

@Component({
  selector: 'app-autocomplete',
  imports: [Button, NgIcon],
  templateUrl: './autocomplete.html',
  styleUrl: './autocomplete.css',
  host: {
    '[class]': '"block w-full"',
  },
})
export class Autocomplete implements FormValueControl<any | any[]> {
  id = input.required<string>();
  // `class` is reserved in TS so we name the field `userClass` and alias the
  // template binding to `class` for ergonomic consumer usage.
  // eslint-disable-next-line @angular-eslint/no-input-rename
  userClass = input('', { alias: 'class' });
  options = input<AutoCompleteOption[]>([]);
  placeholder = input('Search...');

  // FormValueControl Implementation
  // Required models
  readonly value = model<any>();
  readonly touched = model<boolean>(false);

  // Required inputs from FormValueControl
  readonly disabled = input<boolean>(false);
  readonly disabledReasons = input<readonly any[]>([]);
  readonly readonly = input<boolean>(false);
  readonly hidden = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly errors = input<readonly any[]>([]);

  // Other inputs
  readonly multiple = input(false);
  readonly showClear = input(true);
  readonly minLength = input<number | undefined>(1);
  readonly delay = input(300);
  readonly emptyMessage = input('No results found');
  readonly ariaLabel = input('Autocomplete');
  readonly forceSelection = input(false);
  readonly completeOnFocus = input(false);

  // Form Field Inputs
  readonly label = input('');
  readonly hint = input('');
  readonly description = input('');
  readonly required = input(false);

  // ========================================================================
  // OUTPUTS
  // ========================================================================

  readonly completeMethod = output<AutoCompleteCompleteEvent>();
  readonly selectionChange = output<AutoCompleteSelectEvent>();

  // ========================================================================
  // VIEW CHILDREN
  // ========================================================================

  private readonly singleInput = viewChild<ElementRef<HTMLInputElement>>('singleInput');
  private readonly multiInput = viewChild<ElementRef<HTMLInputElement>>('multiInput');
  private readonly overlayTemplate = viewChild<TemplateRef<any>>('overlayTemplate');

  // ========================================================================
  // STATE SIGNALS
  // ========================================================================

  readonly icons = signal({
    xMark: heroXMark,
    check: heroCheck,
    spinner: faSolidSpinner,
  });

  readonly overlayStyle = signal<Record<string, string>>({});

  readonly query = signal('');
  readonly loading = signal(false);
  readonly overlayVisible = signal(false);
  readonly focused = signal(false);
  readonly focusedOptionIndex = signal(-1);

  // ========================================================================
  // COMPUTED SIGNALS
  // ========================================================================

  readonly displayError = computed(() => {
    if (this.invalid()) {
      const errors = this.errors();
      if (errors && errors.length > 0) return errors[0].message;
    }
    return '';
  });

  inputValue = computed(() => {
    const val = this.value();
    if (this.multiple() || !val) return '';

    const option = this.options().find((opt) => this.compareValues(opt.value, val as any));
    return option?.label || '';
  });

  filteredOptions = computed(() => {
    const q = this.query().toLowerCase();
    // In multiple mode, filter out already selected items
    let opts = this.options();
    if (this.multiple()) {
      const selected = this.value() as any[];
      if (Array.isArray(selected)) {
        opts = opts.filter((o) => !selected.some((s) => this.compareValues(s, o.value)));
      }
    }

    if (!q && !this.focused()) return [];

    return opts.filter((opt) => opt.label.toLowerCase().includes(q));
  });

  hasValue = computed(() => {
    const val = this.value();
    return this.multiple()
      ? Array.isArray(val) && val.length > 0
      : val !== null && val !== undefined;
  });

  panelId = computed(() => `autocomplete-panel-${this.hostId}`);

  focusedOptionId = computed(() => {
    const idx = this.focusedOptionIndex();
    return idx >= 0 ? this.getOptionId(idx) : null;
  });

  selectedItems = computed(() => {
    return this.multiple() ? (this.value() as any[]) || [] : [];
  });

  // ========================================================================
  // STYLING COMPUTED
  // ========================================================================

  containerClasses = computed(() =>
    cn(
      'peer floating-input min-h-14 relative flex flex-wrap gap-1.5',
      this.disabled() ? 'cursor-not-allowed opacity-50' : '',
      this.displayError() ? 'border-destructive focus-within:ring-destructive' : '',
    ),
  );

  isPlaceholderShown = computed(() => {
    if (this.multiple()) {
      return this.selectedItems().length === 0 && !this.query();
    }
    return !this.value() && !this.query();
  });

  labelClasses = computed(() =>
    cn(
      'floating-label',
      // If multi-select has values, or input is not empty, float the label
      (this.multiple() && this.selectedItems().length > 0) || !this.isPlaceholderShown()
        ? 'floating-label-active'
        : '',
    ),
  );

  inputClasses = computed(() =>
    cn(
      'flex-1 min-w-0 px-3 text-sm outline-none bg-transparent placeholder:text-transparent',
      this.disabled() ? 'cursor-not-allowed' : '',
      this.multiple() ? 'border-none' : '',
    ),
  );

  chipClasses = () =>
    cn(
      'inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors',
      'bg-secondary text-secondary-foreground text-sm font-medium',
      'hover:bg-secondary/80',
    );

  overlayClasses = () =>
    cn(
      'fixed z-[9999] bg-popover text-popover-foreground rounded-md shadow-md border border-border',
      'animate-in fade-in-0 zoom-in-95 duration-200',
    );

  optionClasses = (index: number) => {
    const isFocused = this.focusedOptionIndex() === index;
    const isOptionSelected = this.isOptionSelected(index);
    const option = this.filteredOptions()[index];

    return cn(
      'px-2 py-1.5 cursor-pointer transition-colors text-sm flex items-center rounded-sm',
      option?.disabled && 'opacity-50 cursor-not-allowed',
      !option?.disabled &&
        (isFocused
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent hover:text-accent-foreground'),
      isOptionSelected && !isFocused && 'bg-secondary text-secondary-foreground',
    );
  };

  // ========================================================================
  // PRIVATE PROPERTIES
  // ========================================================================

  private hostId =
    inject(new HostAttributeToken('id'), { optional: true }) ||
    `autocomplete-${Math.random().toString(36).substr(2, 9)}`;
  private searchTimeout?: number;

  // ========================================================================
  // CONSTRUCTOR & EFFECTS
  // ========================================================================

  private readonly renderer = inject(Renderer2);
  private readonly vcr = inject(ViewContainerRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private overlayView: EmbeddedViewRef<any> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.destroyOverlay());

    // Portal Overlay Effect
    effect((onCleanup) => {
      const visible = this.overlayVisible();
      const template = this.overlayTemplate();

      // SSR guard - overlay portal is browser-only
      if (!isPlatformBrowser(this.platformId)) return;

      if (visible && template) {
        // Create view
        this.overlayView = this.vcr.createEmbeddedView(template);

        // Append to body
        const rootNode = this.overlayView.rootNodes[0] as HTMLElement;
        this.renderer.appendChild(this.document.body, rootNode);

        // Update position initially
        this.updateOverlayPosition();

        // Listen for scroll/resize
        const positionHandler = () => this.updateOverlayPosition();
        window.addEventListener('scroll', positionHandler, true);
        window.addEventListener('resize', positionHandler);

        // Click outside listener
        const clickHandler = (e: MouseEvent) => {
          const target = e.target as Element;
          const container = this.getInputContainer();
          // Check if clicking inside input container or the overlay itself
          if (!container?.contains(target) && !rootNode.contains(target)) {
            this.overlayVisible.set(false);
          }
        };

        const timer = setTimeout(() => this.document.addEventListener('click', clickHandler));

        onCleanup(() => {
          clearTimeout(timer);
          this.document.removeEventListener('click', clickHandler);
          window.removeEventListener('scroll', positionHandler, true);
          window.removeEventListener('resize', positionHandler);
          this.destroyOverlay();
        });
      } else {
        this.destroyOverlay();
      }
    });
  }

  private destroyOverlay(): void {
    if (this.overlayView) {
      const rootNode = this.overlayView.rootNodes[0];
      if (rootNode.parentNode) {
        this.renderer.removeChild(this.document.body, rootNode);
      }
      this.overlayView.destroy();
      this.overlayView = null;
    }
  }

  private updateOverlayPosition(): void {
    if (!this.overlayView) return;

    const inputContainer = this.getInputContainer();
    if (!inputContainer) return;

    const rect = inputContainer.getBoundingClientRect();
    const rootNode = this.overlayView.rootNodes[0] as HTMLElement;

    this.renderer.setStyle(rootNode, 'top', `${rect.bottom}px`);
    this.renderer.setStyle(rootNode, 'left', `${rect.left}px`);
    this.renderer.setStyle(rootNode, 'width', `${rect.width}px`);
  }

  private getInputContainer(): HTMLElement | null {
    return (this.singleInput() || this.multiInput())?.nativeElement.parentElement || null;
  }

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value;

    this.query.set(value);

    // If implementing strict signal value, maybe we should update value here?
    // But autocomplete logic is complex, value is selected option usually, not query string.

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (value.length >= (this.minLength() ?? 1)) {
      this.searchTimeout = window.setTimeout(() => {
        this.loading.set(true);
        this.completeMethod.emit({ query: value, originalEvent: event });
        this.overlayVisible.set(true);
        this.loading.set(false);
      }, this.delay());
    } else {
      this.overlayVisible.set(false);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.disabled() || this.readonly()) return;

    const key = event.key;

    if (key === 'ArrowDown') {
      event.preventDefault();
      if (!this.overlayVisible()) {
        this.overlayVisible.set(true);
      } else {
        this.focusNextOption();
      }
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      this.focusPreviousOption();
    } else if (key === 'Enter') {
      event.preventDefault();
      if (this.focusedOptionIndex() >= 0) {
        const option = this.filteredOptions()[this.focusedOptionIndex()];
        if (option && !option.disabled) {
          this.selectOption(event, option);
        }
      }
    } else if (key === 'Escape') {
      this.overlayVisible.set(false);
      this.focusedOptionIndex.set(-1);
    } else if (key === 'Tab') {
      this.overlayVisible.set(false);
    }
  }

  onFocus(_event: FocusEvent): void {
    this.focused.set(true);
    if (this.options().length > 0) {
      this.overlayVisible.set(true);
    }
  }

  onBlur(_event: FocusEvent): void {
    setTimeout(() => {
      this.focused.set(false);
      this.touched.set(true);
    }, 200);
  }

  onContainerClick(_event: MouseEvent): void {
    if (this.disabled()) return;
    const input = this.getInputElement();
    input?.focus();
  }

  selectOption(event: Event, option: AutoCompleteOption): void {
    if (option.disabled || this.disabled()) return;

    event.preventDefault();
    event.stopPropagation();

    if (this.multiple()) {
      const currentValues = this.value() as any[];
      const exists = currentValues.some((v) => this.compareValues(v, option.value));

      const newValues = exists
        ? currentValues.filter((v) => !this.compareValues(v, option.value))
        : [...currentValues, option.value];

      this.value.set(newValues);

      // Clear input and query
      const input = this.getInputElement();
      if (input) {
        input.value = '';
        input.focus(); // Auto-focus input
      }
      this.query.set('');

      // Close overlay to require typing for next suggestion
      this.overlayVisible.set(false);
    } else {
      this.value.set(option.value);
      this.overlayVisible.set(false);
      this.query.set('');
    }

    this.selectionChange.emit({ value: option.value, originalEvent: event });
    this.focusedOptionIndex.set(-1);
  }

  removeItem(event: Event, index: number): void {
    event.stopPropagation();

    const currentValues = this.value() as any[];
    const newValues = currentValues.filter((_, i) => i !== index);

    this.value.set(newValues);
  }

  clear(event: Event): void {
    event.stopPropagation();

    const emptyValue = this.multiple() ? [] : null;
    this.value.set(emptyValue as any);
    this.query.set('');
    this.overlayVisible.set(false);

    const input = this.getInputElement();
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private focusNextOption(): void {
    const options = this.filteredOptions();
    if (options.length === 0) return;

    let nextIndex = this.focusedOptionIndex() + 1;

    // Skip disabled options
    while (nextIndex < options.length && options[nextIndex].disabled) {
      nextIndex++;
    }

    if (nextIndex < options.length) {
      this.focusedOptionIndex.set(nextIndex);
      this.scrollToOption(nextIndex);
    }
  }

  private focusPreviousOption(): void {
    const options = this.filteredOptions();
    if (options.length === 0) return;

    let prevIndex = this.focusedOptionIndex() - 1;

    // Skip disabled options
    while (prevIndex >= 0 && options[prevIndex].disabled) {
      prevIndex--;
    }

    if (prevIndex >= 0) {
      this.focusedOptionIndex.set(prevIndex);
      this.scrollToOption(prevIndex);
    }
  }

  private scrollToOption(index: number): void {
    const optionEl = this.document.getElementById(this.getOptionId(index));
    optionEl?.scrollIntoView({ block: 'nearest' });
  }

  private getInputElement(): HTMLInputElement | null {
    return this.multiple()
      ? this.multiInput()?.nativeElement || null
      : this.singleInput()?.nativeElement || null;
  }

  getOptionId(index: number): string {
    return `${this.panelId()}-option-${index}`;
  }

  private compareValues(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  isSelected(value: any): boolean {
    const current = this.value();
    if (this.multiple()) {
      return (current as any[]).some((v) => this.compareValues(v, value));
    }
    return this.compareValues(current as any, value);
  }

  private isOptionSelected(index: number): boolean {
    const option = this.filteredOptions()[index];
    return option ? this.isSelected(option.value) : false;
  }

  getDisplayLabel(value: any): string {
    const option = this.options().find((opt) => this.compareValues(opt.value, value));
    return option?.label || String(value);
  }

  onOptionMouseEnter(index: number): void {
    const option = this.filteredOptions()[index];
    if (!option?.disabled) {
      this.focusedOptionIndex.set(index);
    }
  }

  trackByFn(index: number, _item: any): any {
    return index;
  }
}

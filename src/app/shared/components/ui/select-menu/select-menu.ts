import { Listbox, Option } from '@angular/aria/listbox';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import { generateUUID } from '../../../utils/uuid';

export interface SelectMenuOption<V extends string = string> {
  value: V;
  label: string;
}

@Component({
  selector: 'app-select-menu',
  imports: [Listbox, Option, CdkOverlayOrigin, CdkConnectedOverlay, NgIcon],
  templateUrl: './select-menu.html',
  styleUrl: './select-menu.css',
  providers: [provideIcons({ heroChevronDown })],
})
export class SelectMenu<V extends string = string> {
  readonly options = input.required<readonly SelectMenuOption<V>[]>();
  readonly value = input.required<V>();
  readonly placeholder = input<string>('');
  readonly valueChange = output<V>();

  readonly listboxId = `select-menu-${generateUUID()}`;
  readonly isOpen = signal(false);

  private readonly triggerEl = viewChild<ElementRef<HTMLButtonElement>>('triggerEl');
  private readonly listboxEl = viewChild<ElementRef<HTMLUListElement>>('listboxEl');

  readonly currentLabel = computed(() => {
    const v = this.value();
    return this.options().find((o) => o.value === v)?.label ?? this.placeholder();
  });

  toggle() {
    this.isOpen.update((v) => !v);
  }

  close() {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    // Restore focus to the trigger after the overlay detaches.
    queueMicrotask(() => this.triggerEl()?.nativeElement.focus());
  }

  /** Move focus into the listbox once the overlay attaches to the DOM. */
  onOverlayAttached() {
    queueMicrotask(() => this.listboxEl()?.nativeElement.focus());
  }

  onListboxValuesChange(values: V[]) {
    const v = values[0];
    if (v !== undefined && v !== this.value()) {
      this.valueChange.emit(v);
    }
    this.close();
  }
}

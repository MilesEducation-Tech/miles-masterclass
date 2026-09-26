import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matEditOutline, matDeleteOutline } from '@ng-icons/material-icons/outline';
import { UserAddress } from '@core/models/payment.model';

@Component({
  selector: 'app-address',
  imports: [NgIcon],
  templateUrl: './address.html',
  viewProviders: [provideIcons({ matEditOutline, matDeleteOutline })],
  host: {
    role: 'radio',
    '[attr.aria-checked]': 'selected()',
    '[class.selected]': 'selected()',
    '(click)': 'onSelect()',
    '(keydown.enter)': 'onSelect()',
    '(keydown.space)': 'onSelect($event)',
    tabindex: '0',
    '[class.actions-disabled]': 'actionsDisabled()',
    class: 'flex gap-3 p-4 rounded-lg cursor-pointer transition-all duration-200 ',
  },
})
export class Address {
  readonly address = input.required<UserAddress>();
  readonly userName = input<string>('');
  readonly selected = input<boolean>(false);
  readonly actionsDisabled = input<boolean>(false);

  readonly selectedChange = output<UserAddress>();
  readonly edit = output<UserAddress>();
  readonly delete = output<UserAddress>();

  readonly formattedAddress = computed(() => {
    const a = this.address();
    return [a.address1, a.locality, a.landmark, a.city, a.state, a.country, a.zipcode]
      .filter(Boolean)
      .join(', ');
  });

  onSelect(event?: Event): void {
    event?.preventDefault();
    if (this.actionsDisabled()) return;
    this.selectedChange.emit(this.address());
  }

  onEdit(event: Event): void {
    event.stopPropagation();
    if (this.actionsDisabled()) return;
    this.edit.emit(this.address());
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    if (this.actionsDisabled()) return;
    this.delete.emit(this.address());
  }
}

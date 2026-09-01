import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { Auth } from '../../../../../shared/core/services/auth/auth';
import { NotificationService } from '../../../../../shared/core/services/notification/notification';
import { locationJsonMin } from '../../../../../shared/core/constant/location-min';
import {
  disabled,
  form,
  required,
  FormField as AngularFormField,
  minLength,
  maxLength,
} from '@angular/forms/signals';
import { Forms } from '../../../../../shared/components/ui/forms/forms';
import { AriaInput } from '../../../../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../../../../shared/components/ui/button/button';
import { AriaAutocomplete } from '../../../../../shared/components/ui/aria/aria-autocomplete/aria-autocomplete';
import { Address } from '../../components/address/address';

/**
 * Fields the billing form renders and validates. This is the form's own shape,
 * not a wire payload — it stays here so the signal-forms schema keeps its field
 * typing. Map it onto the new backend's address payload at the edges.
 *
 * `zipcode` is a string here (it is an <input> value) even though the old API
 * took a number — the conversion happened at submit.
 */
interface BillingFormState {
  name: string;
  phone_no: string;
  email_id: string;
  address1: string;
  locality: string;
  landmark: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
}

@Component({
  selector: 'app-billing',
  imports: [Forms, AriaInput, Button, AriaAutocomplete, AngularFormField, Address],
  templateUrl: './billing.html',
  styleUrl: './billing.css',
  host: {
    class: 'space-y-4 flex flex-col',
  },
})
export class Billing {
  // ponytail: PaymentFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  readonly facade: any = {
    billingAddress: signal<any[]>([]),
    deleteAddress: (..._args: any[]): any => null,
    isEditingAddress: null as any,
    loadBillingAddress: signal<any[]>([]),
    saveBillingAddress: (..._args: any[]): any => null,
    selectedAddressId: null as any,
    updateBillingAddress: (..._args: any[]): any => null,
  };
  readonly auth = inject(Auth);
  readonly notification = inject(NotificationService);

  readonly billingAddress = computed(() => this.facade.billingAddress());
  readonly selectedAddressId = this.facade.selectedAddressId;

  readonly userName = computed(() => {
    const user = this.auth.currentUser();
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
  });

  readonly showForm = this.facade.isEditingAddress;
  readonly editingAddressId = signal<number | null>(null);

  readonly initialFormState = linkedSignal<BillingFormState>(() => {
    const user = this.auth.currentUser();
    return {
      name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
      email_id: user?.email || '',
      phone_no: user?.phone || '',
      address1: '',
      locality: '',
      landmark: '',
      country: '',
      state: '',
      city: '',
      zipcode: '',
    };
  });

  readonly billingForm = form<BillingFormState>(this.initialFormState, (s) => {
    required(s.name, { message: 'Name is required' });
    required(s.email_id, { message: 'Email is required' });
    required(s.phone_no, { message: 'Phone Number is required' });
    required(s.address1, { message: 'Address is required' });
    required(s.country, { message: 'Country is required' });
    required(s.state, { message: 'State is required' });
    required(s.city, { message: 'City is required' });
    required(s.zipcode, { message: 'Pin Code is required' });

    minLength(s.zipcode, 4, { message: 'Pin Code must be 6 digits' });
    maxLength(s.zipcode, 8, { message: 'Pin Code must be 8 digits' });

    disabled(s.name, { when: () => !!this.initialFormState().name });
    disabled(s.email_id, { when: () => !!this.initialFormState().email_id });
    disabled(s.phone_no, { when: () => !!this.initialFormState().phone_no });

    // Cascading disabled fields
    disabled(s.state, { when: ({ valueOf }) => !valueOf(s.country) });

    disabled(s.city, {
      when: ({ valueOf }) => {
        const country = valueOf(s.country);
        const state = valueOf(s.state);
        return !country || !state;
      },
    });
  });

  // Location Options
  readonly countryOptions: { label: string; value: string }[] = locationJsonMin.map((c) => ({
    label: c.name,
    value: c.name,
  }));

  readonly stateOptions = computed(() => {
    const countryIso2 = this.initialFormState().country;
    if (!countryIso2) return [];
    const country = locationJsonMin.find((c) => c.name === countryIso2);
    return country?.states?.map((s) => ({ label: s.name, value: s.name })) || [];
  });

  readonly cityOptions = computed(() => {
    const countryIso2 = this.initialFormState().country;
    const stateCode = this.initialFormState().state;
    if (!countryIso2 || !stateCode) return [];

    const country = locationJsonMin.find((c) => c.name === countryIso2);
    const state = country?.states?.find((s) => s.name === stateCode);
    return state?.cities?.map((c) => ({ label: c.name, value: c.name })) || [];
  });

  constructor() {
    // Billing addresses used to be fetched inside `paymentGuard` — that was a
    // side-effect inside a route guard (anti-pattern). Loading the data is now
    // the page's responsibility; the guard only verifies cart preconditions.
    this.facade.loadBillingAddress();

    effect(() => {
      const currentCountry = this.initialFormState().country;
      if (currentCountry) {
        untracked(() => {
          // You do untracked mutations if really necessary,
          // though typically user selection just clears visually if options mismatch.
        });
      }
    });

    effect(() => {
      // Touch `initialFormState().state` so the effect stays subscribed —
      // downstream `stateOptions` / `cityOptions` rely on the dependency.
      void this.initialFormState().state;
    });
  }

  selectAddress(address: any): void {
    this.selectedAddressId.set(address.id);
  }

  onEditAddress(address: any): void {
    if (this.showForm()) {
      this.notification.info(
        'Action Blocked',
        'Please save or cancel the current address form first.',
      );
      return;
    }
    this.editingAddressId.set(address.id);
    this.initialFormState.set({
      name: this.userName(),
      email_id: address.email_id,
      phone_no: address.phone_no,
      address1: address.address1,
      locality: address.locality,
      landmark: address.landmark,
      country: address.country,
      state: address.state,
      city: address.city,
      zipcode: String(address.zipcode),
    });
    this.showForm.set(true);
  }

  onDeleteAddress(address: any): void {
    if (this.showForm()) {
      this.notification.info(
        'Action Blocked',
        'Please save or cancel the current address form first.',
      );
      return;
    }
    this.facade.deleteAddress(address.id);
  }

  cancelEditing(): void {
    this.showForm.set(false);
    this.editingAddressId.set(null);
    const user = this.auth.currentUser();
    this.initialFormState.set({
      name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
      email_id: user?.email || '',
      phone_no: user?.phone || '',
      address1: '',
      locality: '',
      landmark: '',
      country: '',
      state: '',
      city: '',
      zipcode: '',
    });
  }

  save() {
    if (this.billingForm().invalid()) return;

    const formValue = this.billingForm().value();
    const payload: any = {
      phone_no: formValue.phone_no,
      email_id: formValue.email_id,
      address1: formValue.address1,
      locality: formValue.locality,
      landmark: formValue.landmark,
      country: formValue.country,
      state: formValue.state,
      city: formValue.city,
      zipcode: Number(formValue.zipcode),
    };

    const editingId = this.editingAddressId();
    if (editingId) {
      this.facade.updateBillingAddress(editingId, payload);
    } else {
      this.facade.saveBillingAddress(payload);
    }

    // Clear form and reset state
    this.cancelEditing();
  }
}

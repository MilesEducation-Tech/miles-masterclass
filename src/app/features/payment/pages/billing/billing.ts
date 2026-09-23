import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { PaymentFacade } from '../../services/payment-facade';
import { NotificationService } from '@core/services/notification/notification';
import { locationJsonMin } from '@features/payment/constants/location-min';
import {
  disabled,
  form,
  required,
  FormField as AngularFormField,
  minLength,
  maxLength,
} from '@angular/forms/signals';
import { Forms } from '@shared/ui/forms/forms';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { Button } from '@shared/ui/button/button';
import { AriaAutocomplete } from '@shared/ui/aria/aria-autocomplete/aria-autocomplete';
import { BillingAddressPayload, UserAddress } from '@core/models/payment.model';
import { Address } from '../../components/address/address';

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
  readonly facade = inject(PaymentFacade);
  readonly notification = inject(NotificationService);

  readonly billingAddress = computed(() => this.facade.billingAddress());
  readonly selectedAddressId = this.facade.selectedAddressId;

  // ponytail: was the signed-in user's name. Nothing to read it from, so the
  // billing form opens blank instead of prefilled.
  readonly userName = computed(() => '');

  readonly showForm = this.facade.isEditingAddress;
  readonly editingAddressId = signal<number | null>(null);

  readonly initialFormState = linkedSignal<
    { name: string } & Omit<BillingAddressPayload, 'zipcode'> & { zipcode: string }
  >(() => {
    // ponytail: name/email/phone were prefilled from the profile.
    return {
      name: '',
      email_id: '',
      phone_no: '',
      address1: '',
      locality: '',
      landmark: '',
      country: '',
      state: '',
      city: '',
      zipcode: '',
    };
  });

  readonly billingForm = form<
    { name: string } & Omit<BillingAddressPayload, 'zipcode'> & { zipcode: string }
  >(this.initialFormState, (s) => {
    required(s.name, { message: 'Name is required' });
    required(s.email_id, { message: 'Email is required' });
    required(s.phone_no, { message: 'Phone Number is required' });
    required(s.address1, { message: 'Address line 1 is required' });
    required(s.country, { message: 'Country is required' });
    required(s.state, { message: 'State is required' });
    required(s.city, { message: 'City is required' });
    required(s.zipcode, { message: 'Pin Code/Zip Code is required' });

    minLength(s.zipcode, 4, { message: 'Pin Code/Zip Code must be 6 digits' });
    maxLength(s.zipcode, 8, { message: 'Pin Code/Zip Code must be 8 digits' });

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

  selectAddress(address: UserAddress): void {
    this.selectedAddressId.set(address.id);
  }

  onEditAddress(address: UserAddress): void {
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

  onDeleteAddress(address: UserAddress): void {
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
    this.initialFormState.set({
      name: '',
      email_id: '',
      phone_no: '',
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
    const payload: BillingAddressPayload = {
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

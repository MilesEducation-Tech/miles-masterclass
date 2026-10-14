import {
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { NotificationService } from '@core/services/notification/notification';
import {
  form,
  required,
  FormField as AngularFormField,
  maxLength,
  disabled,
} from '@angular/forms/signals';

import { Button } from '@shared/ui/button/button';

import {
  ADDRESS_LIMITS,
  Address as AddressModel,
  AddressInput,
} from '@features/payment/models/commerce.model';
import { Address } from '@features/payment/components/address/address';
import { Field } from '@shared/ui/field/field';
import { NgpLabel, NgpDescription } from 'ng-primitives/form-field';
import { Input } from '@shared/ui/input/input';
import { Combobox } from '@shared/ui/combobox/combobox';

/** The form's own shape: every field a string, blanks included. */
interface AddressForm {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  country: string;
  state: string;
  city: string;
  postal_code: string;
}

const EMPTY_FORM: AddressForm = {
  name: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  country: '',
  state: '',
  city: '',
  postal_code: '',
};

/** CAIRA sends a blank optional field as `null`; the form edits it as `''`. */
function toForm(a: AddressModel): AddressForm {
  return {
    name: a.name ?? '',
    phone: a.phone ?? '',
    line1: a.line1,
    line2: a.line2 ?? '',
    landmark: a.landmark ?? '',
    country: a.country,
    state: a.state,
    city: a.city,
    postal_code: a.postal_code,
  };
}

/** Every field trimmed. A blank optional field goes as `""`, which CAIRA stores as `null`. */
function toInput(f: AddressForm): AddressInput {
  return {
    name: f.name.trim(),
    phone: f.phone.trim(),
    line1: f.line1.trim(),
    line2: f.line2.trim(),
    landmark: f.landmark.trim(),
    city: f.city.trim(),
    state: f.state.trim(),
    postal_code: f.postal_code.trim(),
    country: f.country.trim(),
  };
}

/**
 * The billing address picker + form, shown on the review step (there is no separate
 * billing step). The pick lives in `PaymentFacade.selectedAddressId`; the review page
 * puts it on the cart when the learner pays.
 */
@Component({
  selector: 'app-billing-address',
  imports: [Button, AngularFormField, Address, Field, NgpLabel, NgpDescription, Input, Combobox],
  templateUrl: './billing-address.html',
  host: {
    class: 'space-y-4 flex flex-col',
  },
})
export class BillingAddress {
  readonly facade = inject(PaymentFacade);
  readonly notification = inject(NotificationService);

  readonly addresses = this.facade.addresses;
  readonly selectedAddressId = this.facade.selectedAddressId;

  readonly showForm = this.facade.isEditingAddress;
  readonly editingAddressId = signal<string | null>(null);

  readonly initialFormState = linkedSignal<AddressForm>(() => ({ ...EMPTY_FORM }));

  readonly billingForm = form<AddressForm>(this.initialFormState, (s) => {
    required(s.name, { message: 'Name is required' });
    required(s.phone, { message: 'Phone Number is required' });
    required(s.line1, { message: 'Address line 1 is required' });
    required(s.country, { message: 'Country is required' });
    required(s.state, { message: 'State is required' });
    required(s.city, { message: 'City is required' });
    required(s.postal_code, { message: 'Pin Code/Zip Code is required' });

    // CAIRA's own limits (A2), so a too-long value fails here rather than as a 400.
    const L = ADDRESS_LIMITS;
    maxLength(s.name, L.name, { message: `At most ${L.name} characters` });
    maxLength(s.phone, L.phone, { message: `At most ${L.phone} characters` });
    maxLength(s.line1, L.line, { message: `At most ${L.line} characters` });
    maxLength(s.line2, L.line, { message: `At most ${L.line} characters` });
    maxLength(s.landmark, L.line, { message: `At most ${L.line} characters` });
    maxLength(s.city, L.city, { message: `At most ${L.city} characters` });
    maxLength(s.state, L.state, { message: `At most ${L.state} characters` });
    maxLength(s.country, L.country, { message: `At most ${L.country} characters` });
    maxLength(s.postal_code, L.postalCode, {
      message: `At most ${L.postalCode} characters`,
    });

    // Cascading disabled fields
    disabled(s.state, { when: ({ valueOf }) => !valueOf(s.country) });
    disabled(s.city, {
      when: ({ valueOf }) => !valueOf(s.country) || !valueOf(s.state),
    });
  });

  // Location data is ~839 KB gzipped, so it loads only while the address form is
  // open (PROMPT.md §4.4; your Phase 11 decision). Someone who picks a saved
  // address never downloads it. The module is cached after the first import.
  readonly locations = resource({
    params: () => (this.showForm() ? true : undefined),
    loader: () => import('@features/payment/constants/location-min').then((m) => m.locationJsonMin),
  });
  private readonly locationData = computed(() =>
    this.locations.hasValue() ? this.locations.value() : [],
  );

  // Option values are country, state and city NAMES: CAIRA stores the country as a name.
  readonly countryOptions = computed(() =>
    this.locationData().map((c) => ({ label: c.name, value: c.name })),
  );

  readonly countryPlaceholder = computed(() =>
    this.locations.isLoading()
      ? 'Loading countries…'
      : this.locations.error()
        ? "Couldn't load countries, reopen the form to retry"
        : 'Select Country',
  );

  readonly stateOptions = computed(() => {
    const countryName = this.initialFormState().country;
    if (!countryName) return [];
    const country = this.locationData().find((c) => c.name === countryName);
    return country?.states?.map((s) => ({ label: s.name, value: s.name })) || [];
  });

  readonly cityOptions = computed(() => {
    const countryName = this.initialFormState().country;
    const stateName = this.initialFormState().state;
    if (!countryName || !stateName) return [];

    const country = this.locationData().find((c) => c.name === countryName);
    const state = country?.states?.find((s) => s.name === stateName);
    return state?.cities?.map((c) => ({ label: c.name, value: c.name })) || [];
  });

  constructor() {
    // Loading the data is this component's job; the guard only checks cart preconditions.
    this.facade.loadAddresses();
    // `isEditingAddress` lives on the root facade: an open form must not keep Pay disabled
    // after the learner has left this step.
    inject(DestroyRef).onDestroy(() => this.cancelEditing());
  }

  selectAddress(address: AddressModel): void {
    this.selectedAddressId.set(address.id);
  }

  onEditAddress(address: AddressModel): void {
    if (this.showForm()) {
      this.notification.info(
        'Action Blocked',
        'Please save or cancel the current address form first.',
      );
      return;
    }
    this.editingAddressId.set(address.id);
    this.initialFormState.set(toForm(address));
    this.showForm.set(true);
  }

  onDeleteAddress(address: AddressModel): void {
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
    this.initialFormState.set({ ...EMPTY_FORM });
  }

  /** The form closes only once the server accepted it, so a failed save keeps what was typed. */
  save() {
    if (this.billingForm().invalid()) return;

    const input = toInput(this.billingForm().value());
    const editingId = this.editingAddressId();
    if (editingId) {
      this.facade.updateAddress(editingId, input, () => this.cancelEditing());
    } else {
      this.facade.saveAddress(input, () => this.cancelEditing());
    }
  }
}

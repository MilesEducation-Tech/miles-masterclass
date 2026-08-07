import { Component, computed, inject, signal } from '@angular/core';
import { form, required, FormField as AngularFormField, validate } from '@angular/forms/signals';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { Button } from '../../ui/button/button';
import { AriaInput } from '../../ui/aria/aria-input/aria-input';
import { AriaAutocomplete } from '../../ui/aria/aria-autocomplete/aria-autocomplete';
import { Forms } from '../../ui/forms/forms';
import { Logger } from '../../../core/services/logger/logger';
import { AutoCompleteOption } from '../../../core/models/form.model';
import { Auth } from '../../../core/services/auth/auth';

export interface FirmSponsorshipDialogData {
  planId: number;
  planName: string;
}

export interface FirmSponsorshipResult {
  companyId: number;
  companyName: string;
  spocEmail: string | null;
  consent: boolean;
  skipped: boolean;
}

interface SponsorshipFormState {
  company: number | null;
  spocEmail: string;
  consent: boolean;
}

@Component({
  selector: 'app-firm-sponsorship-dialog',
  imports: [Button, AriaInput, AriaAutocomplete, Forms, AngularFormField],
  templateUrl: './firm-sponsorship-dialog.html',
  styleUrl: './firm-sponsorship-dialog.css',
})
export class FirmSponsorshipDialog {
  dialogRef!: DialogRef<FirmSponsorshipDialog, FirmSponsorshipResult | undefined>;
  data!: FirmSponsorshipDialogData;

  private readonly logger = inject(Logger);
  private readonly auth = inject(Auth);

  // ponytail: was `currentUser()?.company?.[0]`. CAIRA's user has no company
  // relation and there is no company lookup endpoint, so there is nothing to
  // pre-fill from. Firm sponsorship is itself an unbacked surface — see the
  // gap register.
  private readonly profileCompany = computed<{ id: number; company_name: string } | null>(
    () => null,
  );

  readonly loading = signal(false);

  readonly initialFormState = signal<SponsorshipFormState>({
    company: this.profileCompany()?.id ?? null,
    spocEmail: '',
    consent: false,
  });

  readonly sponsorshipForm = form(this.initialFormState, (s) => {
    required(s.company, { message: 'Company is required' });
    required(s.consent, { message: 'Consent is required' });
    required(s.spocEmail, { message: 'Consent is required' });
    validate(s.spocEmail, ({ value }) => {
      const val = value();
      if (!val) return null;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(val) ? null : { kind: 'email', message: 'Please enter a valid email' };
    });
  });

  // Company search — mirrors the profile component's debounced live search
  readonly companySearchQuery = signal(this.profileCompany()?.company_name ?? '');

  // ponytail: was a debounced `getCompanyList` search. Point this signal at the
  // new backend's company search and the autocomplete works unchanged — the
  // pinned-company merge below already handles an empty result set.
  private readonly fetchedCompanyOptions = signal<AutoCompleteOption<number>[]>([]);

  // Ensures the user's existing company stays selectable even when not in the fetched page.
  readonly companyOptions = computed<AutoCompleteOption<number>[]>(() => {
    const options = [...this.fetchedCompanyOptions()];
    const pinned = this.profileCompany();
    if (pinned && !options.some((o) => o.value === pinned.id)) {
      options.unshift({ label: pinned.company_name, value: pinned.id });
    }
    return options;
  });

  readonly selectedCompanyOption = computed(() => {
    const companyVal = this.sponsorshipForm().value().company;
    if (companyVal == null) return null;
    return this.companyOptions().find((o) => o.value === companyVal) ?? null;
  });

  close(): void {
    this.dialogRef.close();
  }

  onCompanySearch(query: string): void {
    this.companySearchQuery.set(query);
  }

  submit(): void {
    if (this.sponsorshipForm().invalid()) return;

    const formValue = this.sponsorshipForm().value();
    const selectedOption = this.selectedCompanyOption();

    this.dialogRef.close({
      companyId: selectedOption?.value ?? formValue.company ?? 0,
      companyName: selectedOption?.label ?? '',
      spocEmail: formValue.spocEmail || null,
      consent: formValue.consent,
      skipped: false,
    });
  }

  subscribeAnyway(): void {
    this.dialogRef.close({
      companyId: 0,
      companyName: '',
      spocEmail: null,
      consent: false,
      skipped: true,
    });
  }
}

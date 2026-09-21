import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, finalize, map, of, startWith, switchMap } from 'rxjs';
import { form, required, FormField as AngularFormField, validate } from '@angular/forms/signals';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { Button } from '../../ui/button/button';
import { AriaInput } from '../../ui/aria/aria-input/aria-input';
import { AriaAutocomplete } from '../../ui/aria/aria-autocomplete/aria-autocomplete';
import { Forms } from '../../ui/forms/forms';
import { ApiClient } from '../../../core/services/api-client/api-client';
import { Logger } from '../../../core/services/logger/logger';
import { CompanyList, PROFILE_ROUTES } from '../../../core/models/profile.model';
import { CommonResponse, RouteParams } from '../../../core/models/http.model';
import { AutoCompleteOption } from '../../../core/models/form.model';

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

type CompanyListParams = RouteParams<typeof PROFILE_ROUTES.getCompanyList>;

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

  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);

  // ponytail: was the signed-in user's first company, used to prefill the
  // form. Nothing to prefill from now.
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

  private readonly fetchedCompanyOptions = toSignal(
    toObservable(this.companySearchQuery).pipe(
      debounceTime(300),
      switchMap((search) => {
        // Pair the loading state with the inner observable lifecycle: set true on
        // start, finalize to false on completion/error/switchMap cancellation.
        this.loading.set(true);
        const params: CompanyListParams = { search };
        return this.http
          .get<CommonResponse<CompanyList[]>>(PROFILE_ROUTES.getCompanyList.path, { params })
          .pipe(
            map((res) =>
              (res?.data ?? []).map(
                (c) => ({ label: c.company_name, value: c.id }) as AutoCompleteOption<number>,
              ),
            ),
            catchError((err) => {
              this.logger.error('Failed to load companies', err);
              return of<AutoCompleteOption<number>[]>([]);
            }),
            finalize(() => this.loading.set(false)),
          );
      }),
      startWith<AutoCompleteOption<number>[]>([]),
    ),
    { initialValue: [] as AutoCompleteOption<number>[] },
  );

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

import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  form,
  FormField as FormFieldSignal,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { SelectOption } from '@core/models/form.model';
import { EnquiryService } from '@core/services/enquiry/enquiry';
import { Utils } from '@shared/services/utils';
import { NotificationService } from '@core/services/notification/notification';
import { Button } from '../../ui/button/button';
import { AriaInput } from '../../ui/aria/aria-input/aria-input';
import { AriaMultiselect } from '../../ui/aria/aria-multiselect/aria-multiselect';
import { Forms } from '../../ui/forms/forms';
import { Spinner } from '../../ui/spinner/spinner';
import { RouterLink } from '@angular/router';

export interface EnquiryModel {
  full_name: string;
  email: string;
  firm_name: string;
  job_role: string;
  help_type: string[];
  enquiry_type: string;
  keep_updated: boolean;
}

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const emptyModel = (enquiry_type: string): EnquiryModel => ({
  full_name: '',
  email: '',
  firm_name: '',
  job_role: '',
  help_type: [],
  enquiry_type,
  keep_updated: false,
});

@Component({
  selector: 'app-enquiry-form',
  imports: [Forms, AriaInput, AriaMultiselect, FormFieldSignal, Button, Spinner, RouterLink],
  templateUrl: './enquiry-form.html',
  styleUrl: './enquiry-form.css',
  host: { ngSkipHydration: 'true' },
})
export class EnquiryForm {
  private readonly enquiry = inject(EnquiryService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly utils = inject(Utils);

  protected readonly country = this.utils.country;
  protected readonly profession = this.utils.profession;

  readonly enquiry_type = input<string | undefined>();
  /**
   * Marketing opt-in checkbox label. Defaults to the original wording; pass a
   * different one where the partner supplies their own copy (CPA Canada does).
   */
  readonly keepUpdatedLabel = input<string>('Keep me updated with relevant news and offers');

  readonly isLoading = this.enquiry.isLoading;

  readonly helpTypeOptions: SelectOption<unknown>[] = [
    { value: "I'd like to schedule a demo", label: "I'd like to schedule a demo" },
    { value: 'I need pricing help', label: 'I need help with pricing' },
    { value: 'Partnership inquiry', label: 'Partnership inquiry' },
  ];

  readonly enquiryModel = signal<EnquiryModel>(emptyModel('General Inquiry'));

  readonly enquiryForm = form<EnquiryModel>(this.enquiryModel, (schema) => {
    required(schema.full_name, { message: 'Full name is required' });
    minLength(schema.full_name, 2, { message: 'Full name must be at least 2 characters' });

    required(schema.email, { message: 'Email is required' });
    // `required` drives the asterisk and `aria-required` through FormValueControl,
    // but it never fires here: the framework's emptiness check is `'' | false | null`,
    // and `[]` is none of those. `minLength` is what actually rejects no selection.
    required(schema.help_type, { message: 'Help type is required' });
    minLength(schema.help_type, 1, { message: 'Please select at least one option' });
    validate(schema.email, ({ value }) => {
      if (!EMAIL_PATTERN.test(value())) {
        return { kind: 'email', message: 'Please enter a valid email address' };
      }
      return null;
    });

    required(schema.firm_name, { message: 'Firm name is required' });
    minLength(schema.firm_name, 2, { message: 'Firm name must be at least 2 characters' });
  });

  constructor() {
    effect(() => {
      const type = this.enquiry_type();
      if (type) {
        this.enquiryModel.update((m) => ({ ...m, enquiry_type: type }));
      }
    });
  }

  handleSubmit(): void {
    const formState = this.enquiryForm();
    formState.markAsTouched();
    if (formState.invalid() || this.isLoading()) return;

    this.enquiry
      .submitEnquiry(this.enquiryModel())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.notification.success('Enquiry submitted', res.message);
          formState.reset();
          this.enquiryModel.set(emptyModel(this.enquiry_type() ?? 'General Inquiry'));
        },
        error: (err) => {
          this.notification.error('Submission failed', err.message);
        },
      });
  }
}

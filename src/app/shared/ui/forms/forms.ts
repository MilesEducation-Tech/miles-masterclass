/* eslint-disable @angular-eslint/no-input-rename */
import { Component, input, output, computed } from '@angular/core';
import { FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { cn } from '../../utils/cn';

type FormType = 'signal' | 'model' | 'reactive';

@Component({
  selector: 'app-forms',
  imports: [ReactiveFormsModule, FormsModule, NgTemplateOutlet],
  templateUrl: './forms.html',
})
export class Forms {
  readonly type = input.required<FormType>();
  readonly formGroup = input<FormGroup>();
  readonly userClass = input<string>('', { alias: 'class' });

  readonly formClasses = computed(() => cn('space-y-6', this.userClass()));

  // Outputs
  readonly submitted = output<Event>();

  handleSubmit(event: Event): void {
    event.preventDefault();
    this.submitted.emit(event);
  }
}

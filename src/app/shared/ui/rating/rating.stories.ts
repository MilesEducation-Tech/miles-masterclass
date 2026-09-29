import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField, min } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { Rating } from './rating';

@Component({
  selector: 'app-rating-demo',
  imports: [Field, Rating, FormField, NgpLabel, NgpError, JsonPipe],
  template: `
    <div class="flex w-80 flex-col gap-4">
      <app-field>
        <span ngpLabel>Rate this course</span>
        <app-rating [formField]="f.stars" [allowHalf]="true" />
        <p ngpError ngpErrorValidator="min">Pick at least one star.</p>
      </app-field>
      <app-field>
        <span ngpLabel>Average, read only</span>
        <app-rating [value]="4.5" [allowHalf]="true" [readonly]="true" />
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class RatingDemo {
  readonly model = signal({ stars: 0 });
  readonly f = form(this.model, (s) => {
    min(s.stars, 1);
  });
}

const meta: Meta<RatingDemo> = {
  title: 'UI/Rating',
  component: RatingDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<RatingDemo>;

export const SignalForm: Story = {};

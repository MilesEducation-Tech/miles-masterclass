import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField, max, min } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { Slider } from './slider';

@Component({
  selector: 'app-slider-demo',
  imports: [Field, Slider, FormField, NgpLabel, JsonPipe],
  template: `
    <div class="flex w-80 flex-col gap-4">
      <app-field>
        <span ngpLabel>Playback speed</span>
        <app-slider ariaLabel="Playback speed" [step]="25" [formField]="f.speed" />
      </app-field>
      <app-field>
        <span ngpLabel>Disabled</span>
        <app-slider ariaLabel="Disabled" [value]="30" [disabled]="true" />
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class SliderDemo {
  readonly model = signal({ speed: 100 });
  // `min()` / `max()` in the schema become the slider's `min` / `max`; `[formField]` forbids
  // binding them on the element as well.
  readonly f = form(this.model, (s) => {
    min(s.speed, 50);
    max(s.speed, 200);
  });
}

const meta: Meta<SliderDemo> = {
  title: 'UI/Slider',
  component: SliderDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<SliderDemo>;

export const SignalForm: Story = {};

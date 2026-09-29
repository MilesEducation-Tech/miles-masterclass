import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { ToggleGroup } from './toggle-group';
import { ToggleGroupItem } from './toggle-group-item';

@Component({
  selector: 'app-toggle-group-demo',
  imports: [Field, ToggleGroup, ToggleGroupItem, FormField, NgpLabel, JsonPipe],
  template: `
    <div class="flex w-96 flex-col gap-4">
      <app-field>
        <span ngpLabel>Study days</span>
        <app-toggle-group type="multiple" class="self-start" [formField]="f.days">
          <button app-toggle-group-item type="button" value="mon">Mon</button>
          <button app-toggle-group-item type="button" value="wed">Wed</button>
          <button app-toggle-group-item type="button" value="fri">Fri</button>
        </app-toggle-group>
      </app-field>
      <app-field>
        <span ngpLabel>Content type</span>
        <app-toggle-group type="single" class="self-start" [formField]="f.type">
          <button app-toggle-group-item type="button" value="video">Video</button>
          <button app-toggle-group-item type="button" value="audio">Audio</button>
          <button app-toggle-group-item type="button" value="reel">Reels</button>
        </app-toggle-group>
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class ToggleGroupDemo {
  readonly model = signal<{ days: string[]; type: string[] }>({ days: ['mon'], type: ['video'] });
  readonly f = form(this.model);
}

const meta: Meta<ToggleGroupDemo> = {
  title: 'UI/ToggleGroup',
  component: ToggleGroupDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ToggleGroupDemo>;

export const SignalForm: Story = {};

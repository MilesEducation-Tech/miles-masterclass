import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpLabel } from 'ng-primitives/form-field';
import { leave, settle } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Toggle } from './toggle';

@Component({
  imports: [Field, Toggle, FormField, NgpLabel],
  template: `
    <app-field>
      <span ngpLabel>Bold</span>
      <button app-toggle type="button" [formField]="f.bold">B</button>
    </app-field>
  `,
})
class Host {
  readonly model = signal({ bold: false });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.bold);
    disabled(s.bold, () => this.lock());
  });
}

describe('Toggle (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is an unpressed button named by the field label', () => {
    expect(button().getAttribute('aria-pressed')).toBe('false');
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(button().getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('renders a value set on the model', async () => {
    host.model.set({ bold: true });
    await settle(fixture);

    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().hasAttribute('data-selected')).toBe(true);
  });

  it('writes a click into the model', async () => {
    button().click();
    await settle(fixture);

    expect(host.model().bold).toBe(true);
  });

  it('is disabled by the schema', async () => {
    host.lock.set(true);
    await settle(fixture);

    expect(button().disabled).toBe(true);
    button().click();
    await settle(fixture);
    expect(host.model().bold).toBe(false);
  });

  it('is touched on focusout and then reports invalid', async () => {
    leave(button());
    await settle(fixture);

    expect(host.f.bold().touched()).toBe(true);
    expect(button().getAttribute('aria-invalid')).toBe('true');
  });
});

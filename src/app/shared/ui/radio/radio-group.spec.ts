import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { leave, settle } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { RadioGroup } from './radio-group';
import { RadioItem } from './radio-item';

@Component({
  imports: [Field, RadioGroup, RadioItem, FormField, NgpLabel, NgpError],
  template: `
    <app-field>
      <span ngpLabel>Billing</span>
      <app-radio-group [formField]="f.plan">
        <app-radio-item value="monthly">Monthly</app-radio-item>
        <app-radio-item value="yearly">Yearly</app-radio-item>
      </app-radio-group>
      <p ngpError ngpErrorValidator="required">Choose a billing cycle.</p>
    </app-field>
  `,
})
class Host {
  readonly model = signal<{ plan: string | null }>({ plan: null });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.plan);
    disabled(s.plan, () => this.lock());
  });
}

describe('RadioGroup (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const group = (): HTMLElement => fixture.nativeElement.querySelector('app-radio-group');
  const items = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('app-radio-item'));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is a radiogroup named by the field label with nothing checked', () => {
    expect(group().getAttribute('role')).toBe('radiogroup');
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(group().getAttribute('aria-labelledby')).toBe(label.id);
    expect(items().map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'false']);
  });

  it('renders a value set on the model', async () => {
    host.model.set({ plan: 'yearly' });
    await settle(fixture);

    expect(items()[1].getAttribute('aria-checked')).toBe('true');
    expect(items()[1].hasAttribute('data-checked')).toBe(true);
  });

  it('writes the clicked item into the model', async () => {
    items()[0].click();
    await settle(fixture);

    expect(host.model().plan).toBe('monthly');
  });

  it('is disabled by the schema and ignores clicks', async () => {
    host.lock.set(true);
    await settle(fixture);
    expect(group().hasAttribute('data-disabled')).toBe(true);

    items()[0].click();
    await settle(fixture);
    expect(host.model().plan).toBeNull();
  });

  it('reports invalid once touched with nothing chosen', async () => {
    leave(items()[0]);
    await settle(fixture);

    expect(host.f.plan().touched()).toBe(true);
    expect(group().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('[ngperror]').getAttribute('data-validator')).toBe(
      'fail',
    );
  });
});

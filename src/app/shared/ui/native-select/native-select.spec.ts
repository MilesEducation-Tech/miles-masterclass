import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { leave, settle, typeInto } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { NativeSelect } from './native-select';

@Component({
  imports: [Field, NativeSelect, FormField, NgpLabel, NgpError],
  template: `
    <app-field>
      <label ngpLabel for="country">Country</label>
      <select app-select id="country" [formField]="f.country">
        <option value="">Choose…</option>
        <option value="us">United States</option>
        <option value="in">India</option>
      </select>
      <p ngpError ngpErrorValidator="required">Pick a country.</p>
    </app-field>
  `,
})
class Host {
  readonly model = signal({ country: '' });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.country);
    disabled(s.country, () => this.lock());
  });
}

describe('NativeSelect (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const select = (): HTMLSelectElement => fixture.nativeElement.querySelector('select');

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is labelled by the field and renders the model value', async () => {
    expect(fixture.nativeElement.querySelector('label').getAttribute('for')).toBe(select().id);
    host.model.set({ country: 'in' });
    await settle(fixture);

    expect(select().value).toBe('in');
  });

  it('writes the chosen option into the model', async () => {
    typeInto(select(), 'us');
    await settle(fixture);

    expect(host.model().country).toBe('us');
  });

  it('is disabled by the schema', async () => {
    host.lock.set(true);
    await settle(fixture);

    expect(select().disabled).toBe(true);
  });

  it('reports invalid once touched with nothing chosen', async () => {
    leave(select());
    await settle(fixture);

    expect(host.f.country().touched()).toBe(true);
    expect(select().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('[ngperror]').getAttribute('data-validator')).toBe(
      'fail',
    );
  });
});

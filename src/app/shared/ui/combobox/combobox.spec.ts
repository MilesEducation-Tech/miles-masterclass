import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { flush, leave, settle, typeInto } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Combobox } from './combobox';

@Component({
  imports: [Field, Combobox, FormField, NgpLabel, NgpError],
  template: `
    <app-field>
      <span ngpLabel>City</span>
      <app-combobox [options]="options" placeholder="Search a city" [formField]="f.city" />
      <p ngpError ngpErrorValidator="required">Pick a city.</p>
    </app-field>
  `,
})
class Host {
  readonly options = [
    { value: 'bom', label: 'Mumbai' },
    { value: 'pnq', label: 'Pune' },
    { value: 'dxb', label: 'Dubai' },
  ];
  readonly model = signal<{ city: string | null }>({ city: null });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.city);
    disabled(s.city, () => this.lock());
  });
}

describe('Combobox (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const input = (): HTMLInputElement => fixture.nativeElement.querySelector('input');
  const renderedOptions = (): HTMLElement[] =>
    Array.from(document.querySelectorAll('[ngpcomboboxoption]'));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('starts empty with the placeholder', () => {
    expect(input().value).toBe('');
    expect(input().placeholder).toBe('Search a city');
  });

  it('renders a value set on the model in the input', async () => {
    host.model.set({ city: 'dxb' });
    await settle(fixture);

    expect(input().value).toBe('Dubai');
  });

  it('filters as the user types and writes the clicked option into the model', async () => {
    fixture.nativeElement.querySelector('button').click();
    await flush();
    await settle(fixture);
    expect(renderedOptions().length).toBe(3);

    typeInto(input(), 'pu');
    await flush();
    await settle(fixture);
    expect(renderedOptions().map((o) => o.textContent?.trim())).toEqual(['Pune']);

    renderedOptions()[0].click();
    await settle(fixture);

    expect(host.model().city).toBe('pnq');
    expect(input().value).toBe('Pune');
  });

  it('is disabled by the schema', async () => {
    host.lock.set(true);
    await settle(fixture);

    expect(input().disabled).toBe(true);
  });

  it('reports invalid once touched with nothing chosen', async () => {
    leave(input());
    await settle(fixture);

    expect(host.f.city().touched()).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-invalid="true"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[ngperror]').getAttribute('data-validator')).toBe(
      'fail',
    );
  });
});

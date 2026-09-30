import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { flush, leave, settle } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Select } from './select';

@Component({
  imports: [Field, Select, FormField, NgpLabel, NgpError],
  template: `
    <app-field>
      <span ngpLabel>Profession</span>
      <app-select [options]="options" placeholder="Pick one" [formField]="f.profession" />
      <p ngpError ngpErrorValidator="required">Pick a profession.</p>
    </app-field>
  `,
})
class Host {
  readonly options = [
    { value: 'cpa', label: 'CPA' },
    { value: 'cma', label: 'CMA' },
    { value: 'ea', label: 'EA' },
  ];
  readonly model = signal({ profession: '' });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.profession);
    disabled(s.profession, () => this.lock());
  });
}

describe('Select (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const trigger = (): HTMLElement => fixture.nativeElement.querySelector('app-select');
  /** The dropdown is portalled, so it is not under the fixture element. */
  const renderedOptions = (): HTMLElement[] =>
    Array.from(document.querySelectorAll('[ngpselectoption]'));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  async function open(): Promise<void> {
    trigger().click();
    await flush();
    await settle(fixture);
  }

  it('is a combobox named by the field label, showing the placeholder', () => {
    expect(trigger().getAttribute('role')).toBe('combobox');
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(trigger().getAttribute('aria-labelledby')).toBe(label.id);
    expect(trigger().textContent).toContain('Pick one');
  });

  it('renders a value set on the model', async () => {
    host.model.set({ profession: 'cma' });
    await settle(fixture);

    expect(trigger().textContent).toContain('CMA');
  });

  it('writes the clicked option into the model', async () => {
    await open();
    expect(renderedOptions().map((o) => o.textContent?.trim())).toEqual(['CPA', 'CMA', 'EA']);

    renderedOptions()[2].click();
    await settle(fixture);

    expect(host.model().profession).toBe('ea');
  });

  it('is disabled by the schema', async () => {
    host.lock.set(true);
    await settle(fixture);

    expect(trigger().hasAttribute('data-disabled')).toBe(true);
  });

  it('reports invalid once touched with nothing chosen', async () => {
    leave(trigger());
    await settle(fixture);

    expect(host.f.profession().touched()).toBe(true);
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('[ngperror]').getAttribute('data-validator')).toBe(
      'fail',
    );
  });
});

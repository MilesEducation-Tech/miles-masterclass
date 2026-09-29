import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { leave, settle } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Checkbox } from './checkbox';

@Component({
  imports: [Field, Checkbox, FormField, NgpLabel, NgpError],
  template: `
    <app-field>
      <span ngpLabel>Accept the terms</span>
      <app-checkbox [formField]="f.agree" />
      <p ngpError ngpErrorValidator="required">You must accept the terms.</p>
    </app-field>
  `,
})
class Host {
  readonly model = signal({ agree: false });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.agree);
    disabled(s.agree, () => this.lock());
  });
}

describe('Checkbox (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const checkbox = (): HTMLElement => fixture.nativeElement.querySelector('app-checkbox');

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is an unchecked, required checkbox named by the field label', () => {
    expect(checkbox().getAttribute('role')).toBe('checkbox');
    expect(checkbox().getAttribute('aria-checked')).toBe('false');
    expect(checkbox().getAttribute('aria-required')).toBe('true');
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(checkbox().getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('renders a value set on the model', async () => {
    host.model.set({ agree: true });
    await settle(fixture);

    expect(checkbox().getAttribute('aria-checked')).toBe('true');
    expect(checkbox().hasAttribute('data-checked')).toBe(true);
  });

  it('writes a click into the model', async () => {
    checkbox().click();
    await settle(fixture);

    expect(host.model().agree).toBe(true);
  });

  it('is disabled by the schema and ignores clicks', async () => {
    host.lock.set(true);
    await settle(fixture);
    expect(checkbox().hasAttribute('data-disabled')).toBe(true);

    checkbox().click();
    await settle(fixture);
    expect(host.model().agree).toBe(false);
  });

  it('reports invalid only after being touched', async () => {
    expect(checkbox().getAttribute('aria-invalid')).toBeNull();

    leave(checkbox());
    await settle(fixture);

    expect(host.f.agree().touched()).toBe(true);
    expect(checkbox().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('app-field').hasAttribute('data-invalid')).toBe(
      true,
    );
    expect(fixture.nativeElement.querySelector('[ngperror]').getAttribute('data-validator')).toBe(
      'fail',
    );
  });
});

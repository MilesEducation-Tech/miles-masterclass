import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpDescription, NgpError, NgpLabel } from 'ng-primitives/form-field';
import { leave, settle, typeInto } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Input } from './input';

@Component({
  imports: [Field, Input, FormField, NgpLabel, NgpDescription, NgpError],
  template: `
    <app-field>
      <label ngpLabel for="email">Email</label>
      <p ngpDescription>We never share it.</p>
      <input app-input id="email" type="email" [formField]="f.email" />
      <p ngpError ngpErrorValidator="required">Email is required.</p>
    </app-field>
  `,
})
class Host {
  readonly model = signal({ email: '' });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.email);
    disabled(s.email, () => this.lock());
  });
}

describe('Input (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const input = (): HTMLInputElement => fixture.nativeElement.querySelector('input');
  const field = (): HTMLElement => fixture.nativeElement.querySelector('app-field');

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('starts from a defined model value and is named and described by the field', () => {
    expect(host.model().email).toBe('');
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    expect(input().id).toBe('email');
    expect(label.getAttribute('for')).toBe(input().id);
    expect(input().getAttribute('aria-labelledby')).toBe(label.id);
    const description: HTMLElement = fixture.nativeElement.querySelector('[ngpdescription]');
    // ng-primitives also lists a failing error here from the start; it is hidden until touched.
    expect(input().getAttribute('aria-describedby')).toContain(description.id);
  });

  it('renders a value set on the model', async () => {
    host.model.set({ email: 'a@b.co' });
    await settle(fixture);

    expect(input().value).toBe('a@b.co');
  });

  it('writes what the user types into the model', async () => {
    typeInto(input(), 'me@miles.edu');
    await settle(fixture);

    expect(host.model().email).toBe('me@miles.edu');
  });

  it('is disabled by the schema', async () => {
    host.lock.set(true);
    await settle(fixture);

    expect(input().disabled).toBe(true);
    expect(input().hasAttribute('data-disabled')).toBe(true);
  });

  it('reports invalid only after being touched, and then points at the error', async () => {
    expect(input().getAttribute('aria-invalid')).toBeNull();

    leave(input());
    await settle(fixture);

    expect(host.f.email().touched()).toBe(true);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(field().hasAttribute('data-invalid')).toBe(true);
    const error: HTMLElement = fixture.nativeElement.querySelector('[ngperror]');
    expect(error.getAttribute('data-validator')).toBe('fail');
    expect(input().getAttribute('aria-describedby')).toContain(error.id);
  });
});

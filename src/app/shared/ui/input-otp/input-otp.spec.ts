import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { leave, settle, typeInto } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { InputOtp } from './input-otp';

@Component({
  imports: [Field, InputOtp, FormField, NgpLabel, NgpError],
  template: `
    <app-field>
      <span ngpLabel>Enter the code</span>
      <app-input-otp [length]="4" [formField]="f.code" (complete)="completed = completed + 1" />
      <p ngpError ngpErrorValidator="required">Please enter the code.</p>
    </app-field>
  `,
})
class Host {
  completed = 0;
  readonly model = signal({ code: '' });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.code);
    disabled(s.code, () => this.lock());
  });
}

describe('InputOtp (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const input = (): HTMLInputElement => fixture.nativeElement.querySelector('input');
  const slots = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[ngpinputotpslot]'));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is one real one-time-code input named by the field label, with presentational slots', () => {
    expect(input().getAttribute('autocomplete')).toBe('one-time-code');
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(input().getAttribute('aria-labelledby')).toBe(label.id);
    expect(slots().length).toBe(4);
    expect(slots().every((s) => s.getAttribute('role') === 'presentation')).toBe(true);
  });

  it('renders a value set on the model into the slots', async () => {
    host.model.set({ code: '12' });
    await settle(fixture);

    expect(slots().filter((s) => s.hasAttribute('data-filled')).length).toBe(2);
  });

  it('writes allowed characters into the model and completes on the last slot', async () => {
    typeInto(input(), '1a2');
    await settle(fixture);
    expect(host.model().code).toBe('12');
    expect(host.completed).toBe(0);

    typeInto(input(), '1234');
    await settle(fixture);
    expect(host.model().code).toBe('1234');
    expect(host.completed).toBe(1);
  });

  it('is disabled by the schema', async () => {
    host.lock.set(true);
    await settle(fixture);

    expect(input().disabled).toBe(true);
  });

  it('reports invalid on the real input once touched and empty', async () => {
    leave(input());
    await settle(fixture);

    expect(host.f.code().touched()).toBe(true);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('[ngperror]').getAttribute('data-validator')).toBe(
      'fail',
    );
  });
});

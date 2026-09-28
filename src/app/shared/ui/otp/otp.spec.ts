import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';

import { Otp } from './otp';

@Component({
  imports: [Otp, FormField],
  template: `
    <app-otp
      id="code"
      label="Enter OTP"
      [length]="4"
      [formField]="otpForm.otp"
      (completed)="onCompleted($event)"
    />
  `,
})
class Host {
  readonly model = signal({ otp: '' });
  readonly otpForm = form(this.model, (s) => {
    required(s.otp, { message: 'Please enter the OTP' });
  });
  /** What the form held at the moment `completed` fired. */
  readonly completions: { emitted: string; formValue: string }[] = [];

  onCompleted(code: string): void {
    this.completions.push({ emitted: code, formValue: this.model().otp });
  }
}

describe('Otp', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let input: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
    input = fixture.nativeElement.querySelector('input');
  });

  async function type(text: string): Promise<void> {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  // The DOM lowercases attribute names; jsdom's selectors are case sensitive.
  const slots = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[ngpinputotpslot]'));

  it('names the hidden input by the visible label and takes required from the schema', () => {
    expect(fixture.nativeElement.querySelector('label').getAttribute('for')).toBe('code');
    expect(input.id).toBe('code');
    expect(input.getAttribute('aria-label')).toBeNull();
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(slots().length).toBe(4);
  });

  it('writes only allowed characters into the form and fills the slots', async () => {
    await type('1a23');

    expect(host.model().otp).toBe('123');
    expect(slots().filter((s) => s.hasAttribute('data-filled')).length).toBe(3);
  });

  it('marks the input invalid and points it at the error once touched', async () => {
    expect(input.getAttribute('aria-invalid')).toBeNull();

    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('code-error');
    const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.id).toBe('code-error');
    expect(alert.textContent).toContain('Please enter the OTP');
  });

  it('emits completed once, after the form already holds the full code', async () => {
    await type('12');
    expect(host.completions).toEqual([]);

    await type('1234');
    expect(host.completions).toEqual([{ emitted: '1234', formValue: '1234' }]);
  });
});

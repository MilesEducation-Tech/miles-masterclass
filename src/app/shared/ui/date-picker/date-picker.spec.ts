import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { leave, settle } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { DatePicker } from './date-picker';

@Component({
  imports: [Field, DatePicker, FormField, NgpLabel, NgpError],
  template: `
    <app-field>
      <span ngpLabel>Exam date</span>
      <app-date-picker [formField]="f.when" />
      <p ngpError ngpErrorValidator="required">Pick a date.</p>
    </app-field>
  `,
})
class Host {
  readonly model = signal<{ when: Date | null }>({ when: null });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.when);
    disabled(s.when, () => this.lock());
  });
}

describe('DatePicker (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const picker = (): HTMLElement => fixture.nativeElement.querySelector('app-date-picker');
  const days = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[ngpdatepickerdatebutton]'));
  const selected = (): HTMLButtonElement | undefined =>
    days().find((d) => d.hasAttribute('data-selected'));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is a grid named by the field label with nothing selected', () => {
    expect(fixture.nativeElement.querySelector('[role="grid"]')).not.toBeNull();
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(picker().getAttribute('aria-labelledby')).toBe(label.id);
    expect(selected()).toBeUndefined();
  });

  it('renders a value set on the model', async () => {
    host.model.set({ when: new Date(2026, 0, 15) });
    await settle(fixture);

    expect(selected()?.textContent?.trim()).toBe('15');
    expect(picker().textContent).toContain('January 2026');
  });

  it('writes the clicked day into the model', async () => {
    host.model.set({ when: new Date(2026, 0, 15) });
    await settle(fixture);

    days()
      .find((d) => d.textContent?.trim() === '20' && !d.hasAttribute('data-outside-month'))!
      .click();
    await settle(fixture);

    expect(host.model().when?.getDate()).toBe(20);
    expect(host.model().when?.getMonth()).toBe(0);
  });

  it('is disabled by the schema', async () => {
    host.lock.set(true);
    await settle(fixture);

    expect(picker().hasAttribute('data-disabled')).toBe(true);
  });

  it('reports invalid once touched with nothing chosen', async () => {
    leave(days()[0]);
    await settle(fixture);

    expect(host.f.when().touched()).toBe(true);
    expect(picker().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('[ngperror]').getAttribute('data-validator')).toBe(
      'fail',
    );
  });
});

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { leave, settle, typeInto } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Textarea } from './textarea';

@Component({
  imports: [Field, Textarea, FormField, NgpLabel, NgpError],
  template: `
    <app-field>
      <label ngpLabel for="notes">Notes</label>
      <textarea app-textarea id="notes" [formField]="f.notes"></textarea>
      <p ngpError ngpErrorValidator="required">Notes are required.</p>
    </app-field>
  `,
})
class Host {
  readonly model = signal({ notes: '' });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.notes);
    disabled(s.notes, () => this.lock());
  });
}

describe('Textarea (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const textarea = (): HTMLTextAreaElement => fixture.nativeElement.querySelector('textarea');

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is labelled by the field and renders the model value', async () => {
    expect(fixture.nativeElement.querySelector('label').getAttribute('for')).toBe(textarea().id);
    host.model.set({ notes: 'Hello' });
    await settle(fixture);

    expect(textarea().value).toBe('Hello');
  });

  it('writes what the user types into the model', async () => {
    typeInto(textarea(), 'Typed');
    await settle(fixture);

    expect(host.model().notes).toBe('Typed');
  });

  it('is disabled by the schema', async () => {
    host.lock.set(true);
    await settle(fixture);

    expect(textarea().disabled).toBe(true);
  });

  it('reports invalid once touched and empty', async () => {
    leave(textarea());
    await settle(fixture);

    expect(host.f.notes().touched()).toBe(true);
    expect(textarea().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('[ngperror]').getAttribute('data-validator')).toBe(
      'fail',
    );
  });
});

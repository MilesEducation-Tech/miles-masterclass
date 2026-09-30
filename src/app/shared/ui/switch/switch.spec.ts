import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { NgpLabel } from 'ng-primitives/form-field';
import { leave, settle } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Switch } from './switch';

@Component({
  imports: [Field, Switch, FormField, NgpLabel],
  template: `
    <app-field>
      <span ngpLabel>Email me updates</span>
      <app-switch [formField]="f.updates" />
    </app-field>
  `,
})
class Host {
  readonly model = signal({ updates: false });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    required(s.updates);
    disabled(s.updates, () => this.lock());
  });
}

describe('Switch (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const toggle = (): HTMLElement => fixture.nativeElement.querySelector('app-switch');

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is an off switch named by the field label', () => {
    expect(toggle().getAttribute('role')).toBe('switch');
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(toggle().getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('renders a value set on the model', async () => {
    host.model.set({ updates: true });
    await settle(fixture);

    expect(toggle().getAttribute('aria-checked')).toBe('true');
  });

  it('writes a click into the model', async () => {
    toggle().click();
    await settle(fixture);

    expect(host.model().updates).toBe(true);
  });

  it('is disabled by the schema and ignores clicks', async () => {
    host.lock.set(true);
    await settle(fixture);
    expect(toggle().hasAttribute('data-disabled')).toBe(true);

    toggle().click();
    await settle(fixture);
    expect(host.model().updates).toBe(false);
  });

  it('is touched on focusout and then reports invalid', async () => {
    leave(toggle());
    await settle(fixture);

    expect(host.f.updates().touched()).toBe(true);
    expect(toggle().getAttribute('aria-invalid')).toBe('true');
  });
});

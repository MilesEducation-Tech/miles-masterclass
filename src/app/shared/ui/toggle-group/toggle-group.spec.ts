import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, requiredError, validate } from '@angular/forms/signals';
import { NgpLabel } from 'ng-primitives/form-field';
import { leave, settle } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { ToggleGroup } from './toggle-group';
import { ToggleGroupItem } from './toggle-group-item';

@Component({
  imports: [Field, ToggleGroup, ToggleGroupItem, FormField, NgpLabel],
  template: `
    <app-field>
      <span ngpLabel>Days</span>
      <app-toggle-group type="multiple" [formField]="f.days">
        <button app-toggle-group-item type="button" value="mon">Mon</button>
        <button app-toggle-group-item type="button" value="tue">Tue</button>
      </app-toggle-group>
    </app-field>
  `,
})
class Host {
  readonly model = signal<{ days: string[] }>({ days: [] });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    // `required()` treats an empty array as a value, so an explicit rule states the intent.
    validate(s.days, ({ value }) => (value().length ? undefined : requiredError()));
    disabled(s.days, () => this.lock());
  });
}

describe('ToggleGroup (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const group = (): HTMLElement => fixture.nativeElement.querySelector('app-toggle-group');
  const items = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button'));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is a group named by the field label with nothing selected', () => {
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(group().getAttribute('aria-labelledby')).toBe(label.id);
    expect(items().some((i) => i.hasAttribute('data-selected'))).toBe(false);
  });

  it('renders a value set on the model', async () => {
    host.model.set({ days: ['tue'] });
    await settle(fixture);

    expect(items()[1].hasAttribute('data-selected')).toBe(true);
    expect(items()[0].hasAttribute('data-selected')).toBe(false);
  });

  it('writes the clicked items into the model', async () => {
    items()[0].click();
    await settle(fixture);
    items()[1].click();
    await settle(fixture);

    expect(host.model().days).toEqual(['mon', 'tue']);
  });

  it('is disabled by the schema and ignores clicks', async () => {
    host.lock.set(true);
    await settle(fixture);
    expect(group().hasAttribute('data-disabled')).toBe(true);

    items()[0].click();
    await settle(fixture);
    expect(host.model().days).toEqual([]);
  });

  it('is touched on focusout and then reports invalid', async () => {
    leave(items()[0]);
    await settle(fixture);

    expect(host.f.days().touched()).toBe(true);
    expect(group().getAttribute('aria-invalid')).toBe('true');
  });
});

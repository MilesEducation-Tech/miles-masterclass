import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, requiredError, validate } from '@angular/forms/signals';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { leave, settle } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Listbox } from './listbox';
import { ListboxOption } from './listbox-option';

@Component({
  imports: [Field, Listbox, ListboxOption, FormField, NgpLabel, NgpError],
  template: `
    <app-field>
      <span ngpLabel>Topics</span>
      <app-listbox mode="multiple" [formField]="f.topics">
        <app-listbox-option value="tax">Tax</app-listbox-option>
        <app-listbox-option value="audit">Audit</app-listbox-option>
        <app-listbox-option value="ethics">Ethics</app-listbox-option>
      </app-listbox>
      <p ngpError ngpErrorValidator="required">Pick at least one topic.</p>
    </app-field>
  `,
})
class Host {
  readonly model = signal<{ topics: string[] }>({ topics: [] });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    validate(s.topics, ({ value }) => (value().length ? undefined : requiredError()));
    disabled(s.topics, () => this.lock());
  });
}

describe('Listbox (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const listbox = (): HTMLElement => fixture.nativeElement.querySelector('[role="listbox"]');
  const options = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('app-listbox-option'));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is a multi-select listbox named by the field label', () => {
    expect(listbox().getAttribute('aria-multiselectable')).toBe('true');
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(listbox().getAttribute('aria-labelledby')).toBe(label.id);
    expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
      'false',
    ]);
  });

  it('renders a value set on the model', async () => {
    host.model.set({ topics: ['audit'] });
    await settle(fixture);

    expect(options()[1].hasAttribute('data-selected')).toBe(true);
  });

  it('writes clicked options into the model', async () => {
    options()[0].click();
    await settle(fixture);
    options()[2].click();
    await settle(fixture);

    expect(host.model().topics).toEqual(['tax', 'ethics']);
  });

  it('is disabled by the schema and ignores clicks', async () => {
    host.lock.set(true);
    await settle(fixture);
    expect(listbox().hasAttribute('data-disabled')).toBe(true);

    options()[0].click();
    await settle(fixture);
    expect(host.model().topics).toEqual([]);
  });

  it('reports invalid once touched with nothing chosen', async () => {
    leave(options()[0]);
    await settle(fixture);

    expect(host.f.topics().touched()).toBe(true);
    expect(listbox().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('[ngperror]').getAttribute('data-validator')).toBe(
      'fail',
    );
  });
});

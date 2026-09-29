import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField } from '@angular/forms/signals';
import { NgpLabel } from 'ng-primitives/form-field';
import { leave, settle, typeInto } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Search } from './search';

@Component({
  imports: [Field, Search, FormField, NgpLabel],
  template: `
    <app-field>
      <span ngpLabel>Find a course</span>
      <app-search placeholder="Search courses" [formField]="f.query" />
    </app-field>
  `,
})
class Host {
  readonly model = signal({ query: '' });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    disabled(s.query, () => this.lock());
  });
}

describe('Search (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const input = (): HTMLInputElement => fixture.nativeElement.querySelector('input');
  const clear = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is a search input named by the field label', () => {
    expect(input().type).toBe('search');
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(input().getAttribute('aria-labelledby')).toBe(label.id);
    expect(clear().getAttribute('aria-label')).toBe('Clear search');
  });

  it('renders a value set on the model', async () => {
    host.model.set({ query: 'ethics' });
    await settle(fixture);

    expect(input().value).toBe('ethics');
  });

  it('writes what the user types into the model, and the clear button empties it', async () => {
    typeInto(input(), 'audit');
    await settle(fixture);
    expect(host.model().query).toBe('audit');

    clear().click();
    await settle(fixture);
    expect(host.model().query).toBe('');
  });

  it('is disabled by the schema', async () => {
    host.lock.set(true);
    await settle(fixture);

    expect(input().disabled).toBe(true);
  });

  it('is touched on blur', async () => {
    leave(input());
    await settle(fixture);

    expect(host.f.query().touched()).toBe(true);
  });
});

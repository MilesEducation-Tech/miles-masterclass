import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, minError, validate } from '@angular/forms/signals';
import { NgpLabel } from 'ng-primitives/form-field';
import { leave, settle } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Slider } from './slider';

@Component({
  imports: [Field, Slider, FormField, NgpLabel],
  template: `
    <app-field>
      <span ngpLabel>Volume</span>
      <app-slider ariaLabel="Volume" [formField]="f.volume" />
    </app-field>
  `,
})
class Host {
  readonly model = signal({ volume: 0 });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    // `min()` would also become the slider's `min` input and clamp the thumb, so the rule is
    // stated as a plain validation.
    validate(s.volume, ({ value }) => (value() < 10 ? minError(10) : undefined));
    disabled(s.volume, () => this.lock());
  });
}

describe('Slider (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const slider = (): HTMLElement => fixture.nativeElement.querySelector('app-slider');
  const thumb = (): HTMLElement => fixture.nativeElement.querySelector('[ngpsliderthumb]');
  const press = (key: string) =>
    thumb().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('exposes a labelled slider thumb at the model value', () => {
    expect(thumb().getAttribute('role')).toBe('slider');
    expect(thumb().getAttribute('aria-label')).toBe('Volume');
    expect(thumb().getAttribute('aria-valuenow')).toBe('0');
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(slider().getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('renders a value set on the model', async () => {
    host.model.set({ volume: 50 });
    await settle(fixture);

    expect(thumb().getAttribute('aria-valuenow')).toBe('50');
  });

  it('writes keyboard changes into the model', async () => {
    press('ArrowRight');
    await settle(fixture);

    expect(host.model().volume).toBe(1);
  });

  it('is disabled by the schema and ignores keys', async () => {
    host.lock.set(true);
    await settle(fixture);
    expect(slider().hasAttribute('data-disabled')).toBe(true);

    press('ArrowRight');
    await settle(fixture);
    expect(host.model().volume).toBe(0);
  });

  it('is touched on focusout and then reports invalid', async () => {
    leave(thumb());
    await settle(fixture);

    expect(host.f.volume().touched()).toBe(true);
    expect(slider().getAttribute('aria-invalid')).toBe('true');
  });
});

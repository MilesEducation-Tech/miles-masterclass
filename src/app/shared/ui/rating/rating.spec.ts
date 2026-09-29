import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, min } from '@angular/forms/signals';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { leave, settle } from '@testing/signal-form-host';

import { Field } from '../field/field';
import { Rating } from './rating';

@Component({
  imports: [Field, Rating, FormField, NgpLabel, NgpError],
  template: `
    <app-field>
      <span ngpLabel>Rate this course</span>
      <app-rating [formField]="f.stars" />
      <p ngpError ngpErrorValidator="min">Pick at least one star.</p>
    </app-field>
  `,
})
class Host {
  readonly model = signal({ stars: 0 });
  readonly lock = signal(false);
  readonly f = form(this.model, (s) => {
    min(s.stars, 1);
    disabled(s.stars, () => this.lock());
  });
}

describe('Rating (signal forms contract)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const rating = (): HTMLElement => fixture.nativeElement.querySelector('app-rating');
  const press = (key: string) =>
    rating().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle(fixture);
  });

  it('is a slider-like control named by the field label, starting at 0 of 5', () => {
    const label: HTMLElement = fixture.nativeElement.querySelector('[ngplabel]');
    expect(rating().getAttribute('aria-labelledby')).toBe(label.id);
    expect(rating().getAttribute('aria-valuenow')).toBe('0');
    expect(rating().getAttribute('aria-valuemax')).toBe('5');
  });

  it('renders a value set on the model', async () => {
    host.model.set({ stars: 3 });
    await settle(fixture);

    expect(rating().getAttribute('aria-valuenow')).toBe('3');
  });

  it('writes keyboard changes into the model', async () => {
    press('ArrowRight');
    await settle(fixture);
    press('ArrowRight');
    await settle(fixture);

    expect(host.model().stars).toBe(2);
  });

  it('is disabled by the schema and ignores keys', async () => {
    host.lock.set(true);
    await settle(fixture);
    expect(rating().hasAttribute('data-disabled')).toBe(true);

    press('ArrowRight');
    await settle(fixture);
    expect(host.model().stars).toBe(0);
  });

  it('reports invalid once touched below the minimum', async () => {
    leave(rating());
    await settle(fixture);

    expect(host.f.stars().touched()).toBe(true);
    expect(rating().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('[ngperror]').getAttribute('data-validator')).toBe(
      'fail',
    );
  });
});

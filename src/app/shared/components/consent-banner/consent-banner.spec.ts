import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DEFAULT_CONSENT } from '@core/models/consent.model';
import { Consent } from '@core/services/consent/consent';

import { ConsentBanner } from './consent-banner';

describe('ConsentBanner preference switches', () => {
  let fixture: ComponentFixture<ConsentBanner>;
  let host: HTMLElement;
  const save = vi.fn();

  // A lookup rather than an attribute selector: jsdom's selector engine mishandles the
  // `&` in titles such as "Analytics & performance".
  const switchFor = (title: string) =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('[role="switch"]')).find(
      (el) => el.getAttribute('aria-label') === title,
    )!;

  beforeEach(async () => {
    save.mockClear();
    await TestBed.configureTestingModule({
      imports: [ConsentBanner],
      providers: [
        {
          provide: Consent,
          useValue: {
            state: signal({ ...DEFAULT_CONSENT }),
            bannerOpen: signal(true),
            preferencesOpen: signal(true),
            save,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsentBanner);
    host = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('renders one ng-primitives switch per tier', () => {
    expect(host.querySelectorAll('[role="switch"]').length).toBe(5);
  });

  it('locked tiers are on and cannot be toggled', async () => {
    const necessary = switchFor('Strictly necessary');
    expect(necessary.getAttribute('aria-checked')).toBe('true');
    expect(necessary.disabled).toBe(true);

    necessary.click();
    await fixture.whenStable();
    expect(necessary.getAttribute('aria-checked')).toBe('true');
  });

  it('an optional tier toggles on click, and the draft is what gets saved', async () => {
    const analytics = switchFor('Analytics & performance');
    expect(analytics.getAttribute('aria-checked')).toBe('false');

    analytics.click();
    await fixture.whenStable();
    expect(analytics.getAttribute('aria-checked')).toBe('true');
    expect(analytics.hasAttribute('data-checked')).toBe(true);

    // Space/Enter on a <button> switch are the browser's native click activation, which
    // jsdom does not synthesise; the keyboard path is covered by the browser check.
    analytics.click();
    await fixture.whenStable();
    expect(analytics.getAttribute('aria-checked')).toBe('false');

    analytics.click();
    await fixture.whenStable();
    const saveBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save my choices',
    )!;
    saveBtn.click();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ analytics: true }));
  });
});

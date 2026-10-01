import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '@testing/transloco';

import { AuthSession } from '@core/services/auth-session/auth-session';

import { Footer } from './footer';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([]), provideTranslocoTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Footer session', () => {
  async function linkTexts(signedIn: boolean): Promise<string[]> {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [
        provideRouter([]),
        provideTranslocoTesting(),
        { provide: AuthSession, useValue: { isAuthenticated: signal(signedIn) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Footer);
    await fixture.whenStable();
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('a')).map((a) =>
      (a.textContent ?? '').trim(),
    );
  }

  it('shows guest-only links to a signed-out visitor', async () => {
    const links = await linkTexts(false);
    expect(links).toContain('Home');
    expect(links).not.toContain('CPE Tracker');
  });

  it('swaps guest-only links for signed-in ones after login', async () => {
    const links = await linkTexts(true);
    expect(links).not.toContain('Home');
    expect(links).toContain('CPE Tracker');
  });
});

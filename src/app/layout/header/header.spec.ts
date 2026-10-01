import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '@testing/transloco';

import { AccountApi } from '@core/services/account-api/account-api';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NotificationService } from '@core/services/notification/notification';
import { Viewport } from '@core/services/viewport/viewport';
import { Utils } from '@shared/services/utils';

import { Header } from './header';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([]), provideTranslocoTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Header mobile drawer focus', () => {
  let fixture: ComponentFixture<Header>;
  let host: HTMLElement;

  const toggler = () =>
    host.querySelector<HTMLButtonElement>('button[aria-controls="mobile-nav-panel"]')!;
  const drawer = () => host.querySelector<HTMLElement>('#mobile-nav-panel');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        provideTranslocoTesting(),
        { provide: Viewport, useValue: { isHandheld: signal(true), screen: signal('mobile') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    host = fixture.nativeElement;
    document.body.appendChild(host);
    await fixture.whenStable();
  });

  afterEach(() => host.remove());

  async function open(): Promise<void> {
    toggler().focus();
    toggler().click();
    await fixture.whenStable();
  }

  it('traps focus in the open drawer and moves focus into it', async () => {
    await open();

    expect(drawer()).not.toBeNull();
    expect(drawer()!.hasAttribute('data-focus-trap')).toBe(true);
    expect(drawer()!.contains(document.activeElement)).toBe(true);
  });

  it('returns focus to the toggler when the drawer closes with focus inside it', async () => {
    await open();

    fixture.componentInstance.closeMobileMenu();
    await fixture.whenStable();

    expect(drawer()).toBeNull();
    expect(document.activeElement).toBe(toggler());
  });

  it('an outside click closes the drawer and returns focus to the toggler', async () => {
    await open();

    document.body.click();
    await fixture.whenStable();

    expect(drawer()).toBeNull();
    expect(document.activeElement).toBe(toggler());
  });
});

describe('Header session', () => {
  const user = {
    first_name: 'Ada',
    full_name: 'Ada Lovelace',
    is_onboarding_completed: true,
    is_profile_completed: true,
    Pathway: 'No',
    Enrolled_status: 'No',
    Enrolled_course: [],
    onboarding_fully_completed: true,
  };

  async function render(opts: { signedIn: boolean; mobile?: boolean; logoutOk?: boolean }) {
    const logout = vi.fn().mockResolvedValue(opts.logoutOk ?? true);
    const error = vi.fn();
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        provideTranslocoTesting(),
        {
          provide: AuthSession,
          useValue: { isAuthenticated: signal(opts.signedIn), logout },
        },
        {
          provide: AccountApi,
          useValue: { user: { hasValue: () => opts.signedIn, value: () => user } },
        },
        { provide: NotificationService, useValue: { error } },
        // The real Utils pulls every feature-dialog token from app.config;
        // the header tree only calls localePath.
        { provide: Utils, useValue: { localePath: (path: string) => `/us/cpa/${path}` } },
        {
          provide: Viewport,
          useValue: {
            isHandheld: signal(opts.mobile ?? false),
            screen: signal(opts.mobile ? 'mobile' : 'desktop'),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement, logout, error };
  }

  it('renders the avatar menu when signed in and not when signed out', async () => {
    const signedIn = await render({ signedIn: true });
    expect(signedIn.host.querySelector('app-user-avatar-menu')).not.toBeNull();

    TestBed.resetTestingModule();
    const signedOut = await render({ signedIn: false });
    expect(signedOut.host.querySelector('app-user-avatar-menu')).toBeNull();
  });

  it('shows the name and initials from user-details in the mobile drawer', async () => {
    const { fixture, host } = await render({ signedIn: true, mobile: true });
    host.querySelector<HTMLButtonElement>('button[aria-controls="mobile-nav-panel"]')!.click();
    await fixture.whenStable();

    const drawer = host.querySelector('#mobile-nav-panel')!;
    expect(drawer.textContent).toContain('Ada Lovelace');
    expect(drawer.textContent).toContain('AL');
  });

  it('keeps the session and says so when the drawer sign-out fails', async () => {
    const { fixture, logout, error } = await render({
      signedIn: true,
      mobile: true,
      logoutOk: false,
    });

    await fixture.componentInstance.signOut();

    expect(logout).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });
});

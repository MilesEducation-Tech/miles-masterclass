import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Viewport } from '@core/services/viewport/viewport';

import { Header } from './header';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
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

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NavItem } from '@core/models/nav.model';
import { Utils } from '@shared/services/utils';
import { NavMenuItem } from './nav-menu-item';

const MENU: NavItem = {
  label: 'Library',
  type: 'menu',
  children: [{ label: 'Course Library', type: 'link', route: 'library/course-library' }],
};

/**
 * Where the flyout opens. It opens toward the inline end (right, or left on an RTL page) and flips to
 * the other side only when that side overflows and the other has room. Panel 300px + margin 16px.
 */
describe('NavMenuItem flyout side', () => {
  afterEach(() => vi.restoreAllMocks());

  function flipped(
    trigger: { left: number; right: number },
    dir: 'ltr' | 'rtl',
    viewport = 1440,
  ): boolean {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NavMenuItem],
      providers: [
        provideRouter([]),
        { provide: Utils, useValue: { localePath: (r: string) => r } },
      ],
    });
    const fixture = TestBed.createComponent(NavMenuItem);
    fixture.componentRef.setInput('item', MENU);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ ...trigger } as DOMRect);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ direction: dir } as CSSStyleDeclaration);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(viewport);

    const menu = fixture.componentInstance;
    menu.subPanelOpen.set(true);
    menu.recheckPosition();
    return menu.flipped();
  }

  it('opens rightwards on an LTR page while there is room', () => {
    expect(flipped({ left: 200, right: 400 }, 'ltr')).toBe(false);
  });

  it('flips leftwards on an LTR page near the right edge', () => {
    expect(flipped({ left: 1100, right: 1300 }, 'ltr')).toBe(true);
  });

  it('opens leftwards on an RTL page while there is room', () => {
    // Near the RIGHT edge: the old physical check flipped this, opening off-screen to the right.
    expect(flipped({ left: 1000, right: 1200 }, 'rtl')).toBe(false);
  });

  it('flips rightwards on an RTL page near the left edge', () => {
    expect(flipped({ left: 100, right: 300 }, 'rtl')).toBe(true);
  });

  it('stays put when neither side has room', () => {
    expect(flipped({ left: 100, right: 300 }, 'rtl', 500)).toBe(false);
  });
});

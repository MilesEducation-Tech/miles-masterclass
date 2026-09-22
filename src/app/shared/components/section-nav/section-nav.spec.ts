import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { SectionNav, SectionNavItem } from './section-nav';
import { SectionNavService } from '@core/services/section-nav/section-nav';

/**
 * Two things about this host are load-bearing.
 *
 * 1. The inputs are signals. Change detection here is zoneless, so reassigning
 *    a plain field and calling `detectChanges()` never marks the view dirty and
 *    the binding silently keeps its old value — which is why the mode-switch
 *    and input-change tests used to assert against stale DOM.
 * 2. `shareWithHeader` is exposed so the render tests can opt out of the
 *    docking behaviour. `SectionNavService.checkNavPosition()` reads
 *    `getBoundingClientRect()`, which is all-zeros in jsdom, so `rect.top (0)
 *    <= TRIGGER_OFFSET (80)` is always true and the service parks the nav in
 *    the header — hiding the inline nav entirely. The docking rule gets its own
 *    test below instead of silently breaking every rendering test.
 */
@Component({
  template: `<app-section-nav
    [items]="items()"
    [mode]="mode()"
    [shareWithHeader]="shareWithHeader()"
  />`,
  imports: [SectionNav],
})
class TestHostComponent {
  readonly items = signal<SectionNavItem[]>([
    { id: 'section1', label: 'Section 1', visible: true, icon: 'lucideHome' },
    { id: 'section2', label: 'Section 2', visible: false },
    { id: 'section3', label: 'Section 3', visible: true },
    { id: 'section4', label: 'Section 4', visible: true, icon: 'lucideStar' },
  ]);
  readonly mode = signal<'inline' | 'header' | 'sidenav'>('inline');
  readonly shareWithHeader = signal(true);
}

describe('SectionNav', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('inline mode', () => {
    beforeEach(() => {
      component.shareWithHeader.set(false);
      fixture.detectChanges();
    });

    it('should only render visible items', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      expect(buttons.length).toBe(3);
      expect(buttons[0].textContent.trim()).toContain('Section 1');
      expect(buttons[1].textContent.trim()).toContain('Section 3');
      expect(buttons[2].textContent.trim()).toContain('Section 4');
    });

    it('should have navigation role and aria label', () => {
      const nav = fixture.nativeElement.querySelector('nav');
      expect(nav.getAttribute('role')).toBe('navigation');
      expect(nav.getAttribute('aria-label')).toBe('Page sections');
    });

    it('should render icons when provided', () => {
      const icons = fixture.nativeElement.querySelectorAll('ng-icon');
      expect(icons.length).toBe(2); // Section 1 and Section 4 have icons
    });

    it('should update visible items when input changes', () => {
      component.items.set([
        { id: 'section1', label: 'Section 1', visible: true },
        { id: 'section2', label: 'Section 2', visible: true },
        { id: 'section3', label: 'Section 3', visible: true },
      ]);
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('button');
      expect(buttons.length).toBe(3);
    });
  });

  describe('header docking', () => {
    it('hides the inline nav while the service says it is docked in the header', () => {
      // Default `shareWithHeader` is true, and in jsdom the service always
      // reports `showInHeader`, so the inline nav yields to the header copy.
      expect(TestBed.inject(SectionNavService).showInHeader()).toBe(true);
      expect(fixture.nativeElement.querySelector('.inline-nav')).toBeNull();
    });

    it('keeps the inline nav when the component opts out of sharing', () => {
      component.shareWithHeader.set(false);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.inline-nav')).toBeTruthy();
    });
  });

  describe('sidenav mode', () => {
    beforeEach(() => {
      component.mode.set('sidenav');
      fixture.detectChanges();
    });

    it('should render sidenav with vertical layout', () => {
      const sidenav = fixture.nativeElement.querySelector('.sidenav');
      expect(sidenav).toBeTruthy();
    });

    it('should render icons in sidenav mode', () => {
      const icons = fixture.nativeElement.querySelectorAll('.sidenav-icon');
      expect(icons.length).toBe(2);
    });

    it('should have labels with sidenav-label class', () => {
      const labels = fixture.nativeElement.querySelectorAll('.sidenav-label');
      expect(labels.length).toBe(3);
    });
  });
});

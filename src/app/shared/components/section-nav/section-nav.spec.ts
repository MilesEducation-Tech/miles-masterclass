import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { SectionNav, SectionNavItem } from './section-nav';

@Component({
  template: `<app-section-nav [items]="items" [mode]="mode" />`,
  imports: [SectionNav],
})
class TestHostComponent {
  items: SectionNavItem[] = [
    { id: 'section1', label: 'Section 1', visible: true, icon: 'lucideHome' },
    { id: 'section2', label: 'Section 2', visible: false },
    { id: 'section3', label: 'Section 3', visible: true },
    { id: 'section4', label: 'Section 4', visible: true, icon: 'lucideStar' },
  ];
  mode: 'inline' | 'header' | 'sidenav' = 'inline';
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
      component.items = [
        { id: 'section1', label: 'Section 1', visible: true },
        { id: 'section2', label: 'Section 2', visible: true },
        { id: 'section3', label: 'Section 3', visible: true },
      ];
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('button');
      expect(buttons.length).toBe(3);
    });
  });

  describe('sidenav mode', () => {
    beforeEach(() => {
      component.mode = 'sidenav';
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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrackerToolbar } from './tracker-toolbar';

describe('TrackerToolbar', () => {
  let component: TrackerToolbar;
  let fixture: ComponentFixture<TrackerToolbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackerToolbar],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackerToolbar);
    fixture.componentRef.setInput('selectedYear', 2026);
    fixture.componentRef.setInput('yearOptions', [2026, 2025]);
    fixture.componentRef.setInput('studyFilter', 'All');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits yearChange when the year select is changed', () => {
    fixture.detectChanges();
    const captured: number[] = [];
    component.yearChange.subscribe((v) => captured.push(v));

    const yearSelect = (fixture.nativeElement as HTMLElement).querySelectorAll(
      'select',
    )[1] as HTMLSelectElement;
    yearSelect.value = '2025';
    yearSelect.dispatchEvent(new Event('change'));

    expect(captured).toEqual([2025]);
  });

  it('emits studyFilterChange when the filter select is changed', () => {
    fixture.detectChanges();
    const captured: string[] = [];
    component.studyFilterChange.subscribe((v) => captured.push(v));

    const filterSelect = (fixture.nativeElement as HTMLElement).querySelectorAll(
      'select',
    )[0] as HTMLSelectElement;
    filterSelect.value = 'Ethics';
    filterSelect.dispatchEvent(new Event('change'));

    expect(captured).toEqual(['Ethics']);
  });
});

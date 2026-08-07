import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrackerTable } from './tracker-table';
import { TrackerTableRow } from '../../mappers/report-to-table';
import { ReportRow } from '../../../../../shared/core/models/cpe-tracker.model';

const sampleRow: TrackerTableRow = {
  key: 'masterclass-1',
  id: 1,
  courseName: 'Ethics 101',
  fieldsOfStudy: [{ id: 1, name: 'Ethics', cpe_credits: 2 }],
  deliveryMethod: 'QAS Self Study',
  totalCredits: 2,
  completedAt: '2026-01-10T10:00:00Z',
  registeredAt: null,
  cairaLevel: 1,
  actionKind: 'feedback',
  raw: {} as ReportRow,
};

describe('TrackerTable', () => {
  let component: TrackerTable;
  let fixture: ComponentFixture<TrackerTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackerTable],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackerTable);
    fixture.componentRef.setInput('rows', []);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the empty state when rows is empty and isLoading is false', () => {
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No courses to show');
  });

  it('emits rowAction with the clicked row', () => {
    fixture.componentRef.setInput('rows', [sampleRow]);
    fixture.detectChanges();

    const captured: TrackerTableRow[] = [];
    component.rowAction.subscribe((r) => captured.push(r));

    // Row now renders [title button, ...action button]. Target the last
    // button so this test stays scoped to the row-action affordance.
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('li button');
    (buttons[buttons.length - 1] as HTMLButtonElement).click();

    expect(captured).toEqual([sampleRow]);
  });

  it('emits titleClick when the title cell is clicked and id is non-null', () => {
    fixture.componentRef.setInput('rows', [sampleRow]);
    fixture.detectChanges();

    const captured: TrackerTableRow[] = [];
    component.titleClick.subscribe((r) => captured.push(r));

    const titleButton = (fixture.nativeElement as HTMLElement).querySelector(
      'li button',
    ) as HTMLButtonElement;
    titleButton.click();

    expect(captured).toEqual([sampleRow]);
  });

  it('renders the title as plain text (no button) when id is null', () => {
    fixture.componentRef.setInput('rows', [{ ...sampleRow, id: null }]);
    fixture.detectChanges();

    const titleSpan = (fixture.nativeElement as HTMLElement).querySelector('li > span.truncate');
    expect(titleSpan?.textContent).toContain('Ethics 101');
  });
});

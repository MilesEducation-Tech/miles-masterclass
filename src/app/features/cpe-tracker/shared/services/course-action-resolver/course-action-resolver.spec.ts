import { TestBed } from '@angular/core/testing';
import { CourseActionResolver } from './course-action-resolver';
import { ButtonKind, TrackerTableRow } from '../../mappers/report-to-table';

function makeTableRow(actionKind: ButtonKind): TrackerTableRow {
  return {
    key: `x-${actionKind}`,
    id: 1,
    courseName: 'X',
    fieldsOfStudy: [],
    deliveryMethod: 'QAS Self Study',
    totalCredits: 1,
    completedAt: null,
    registeredAt: null,
    cairaLevel: null,
    actionKind,
    raw: {} as any,
  };
}

describe('CourseActionResolver', () => {
  let service: CourseActionResolver;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CourseActionResolver);
  });

  it('maps every ButtonKind to a label + variant', () => {
    const kinds: ButtonKind[] = [
      'registered',
      'resume',
      'exam',
      'retake',
      'feedback',
      'download',
      'view-details',
      'none',
    ];
    const labels = kinds.map((k) => service.resolve(makeTableRow(k)));

    expect(labels.map((a) => a.kind)).toEqual(kinds);
    expect(labels.find((a) => a.kind === 'resume')?.label).toBe('Resume');
    expect(labels.find((a) => a.kind === 'exam')?.label).toBe('Take Exam');
    expect(labels.find((a) => a.kind === 'retake')?.label).toBe('Retake Exam');
    expect(labels.find((a) => a.kind === 'feedback')?.label).toBe('Feedback');
    expect(labels.find((a) => a.kind === 'download')?.variant).toBe('outline');
    expect(labels.find((a) => a.kind === 'view-details')?.label).toBe('View Details');
    expect(labels.find((a) => a.kind === 'none')?.variant).toBe('ghost');
  });
});

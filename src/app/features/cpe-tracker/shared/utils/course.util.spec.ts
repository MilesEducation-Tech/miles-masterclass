import {
  getCourseId,
  getCourseName,
  getDeliveryMethod,
  getFieldOfStudyNames,
  getTotalCredits,
  getUrlSegment,
} from './course.util';
import { ReportRow } from '../../../../shared/core/models/cpe-tracker.model';

function row(overrides: Partial<ReportRow>): ReportRow {
  return {
    id: 1,
    master_class: null,
    nano_learning: null,
    podcast: null,
    webinar_details: null,
    course_name: 'Test',
    transaction_type: 'masterclass',
    field_of_study: [],
    all_classes_completed: false,
    ...overrides,
  } as ReportRow;
}

describe('course.util', () => {
  describe('getCourseId', () => {
    it('prefers master_class over other identifiers', () => {
      expect(getCourseId(row({ master_class: 10, nano_learning: 20, podcast: 30 }))).toBe(10);
    });

    it('falls through to nano_learning, then podcast, then webinar_details', () => {
      expect(getCourseId(row({ nano_learning: 20, podcast: 30 }))).toBe(20);
      expect(getCourseId(row({ podcast: 30 }))).toBe(30);
      expect(getCourseId(row({ webinar_details: { webinar_id: 40 } }))).toBe(40);
    });

    it('returns null when no identifier is present', () => {
      expect(getCourseId(row({}))).toBeNull();
    });
  });

  describe('getCourseName', () => {
    it('prefers course_name', () => {
      expect(getCourseName(row({ course_name: 'Ethics 101' }))).toBe('Ethics 101');
    });

    it('falls back to webinar name when course_name is empty', () => {
      expect(
        getCourseName(
          row({
            course_name: '',
            webinar_details: { webinar_id: 1, webinar_name: 'Live Tax Update' },
          }),
        ),
      ).toBe('Live Tax Update');
    });
  });

  describe('getUrlSegment', () => {
    it('maps each transaction_type to its URL segment', () => {
      expect(getUrlSegment(row({ transaction_type: 'masterclass' }))).toBe('masterclass');
      expect(getUrlSegment(row({ transaction_type: 'nano_learning' }))).toBe('micro-learning');
      expect(getUrlSegment(row({ transaction_type: 'podcast' }))).toBe('podcast');
      expect(getUrlSegment(row({ transaction_type: 'webinar' }))).toBe('webinar');
    });
  });

  describe('getFieldOfStudyNames / getTotalCredits', () => {
    it('returns the field names in order', () => {
      expect(
        getFieldOfStudyNames(
          row({
            field_of_study: [
              { id: 1, name: 'Accounting', cpe_credits: 2 },
              { id: 2, name: 'Ethics', cpe_credits: 1 },
            ],
          }),
        ),
      ).toEqual(['Accounting', 'Ethics']);
    });

    it('uses total_credits when provided, otherwise sums field credits', () => {
      expect(getTotalCredits(row({ total_credits: 7 }))).toBe(7);
      expect(
        getTotalCredits(
          row({
            field_of_study: [
              { id: 1, name: 'Accounting', cpe_credits: 2 },
              { id: 2, name: 'Ethics', cpe_credits: 1.5 },
            ],
          }),
        ),
      ).toBe(3.5);
    });
  });

  describe('getDeliveryMethod', () => {
    it('returns the stored delivery method when present', () => {
      expect(getDeliveryMethod(row({ delivery_method: 'Custom Delivery' }))).toBe(
        'Custom Delivery',
      );
    });

    it('defaults webinars to "Group Internet Based"', () => {
      expect(getDeliveryMethod(row({ transaction_type: 'webinar' }))).toBe('Group Internet Based');
    });

    it('defaults everything else to "QAS Self Study"', () => {
      expect(getDeliveryMethod(row({ transaction_type: 'masterclass' }))).toBe('QAS Self Study');
    });
  });
});

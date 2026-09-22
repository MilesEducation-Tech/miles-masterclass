import { toApiCourseType } from './utils';

describe('toApiCourseType', () => {
  it('maps display labels from course payloads', () => {
    expect(toApiCourseType('Video')).toBe('masterclass');
    expect(toApiCourseType('Podcast')).toBe('podcast');
    expect(toApiCourseType('Audio')).toBe('podcast');
  });

  it('maps the api and tracker tokens', () => {
    expect(toApiCourseType('masterclass')).toBe('masterclass');
    expect(toApiCourseType('podcast')).toBe('podcast');
    expect(toApiCourseType('nano_learning')).toBe('micro_learning');
    expect(toApiCourseType('micro_learning')).toBe('micro_learning');
    expect(toApiCourseType('micro-learning')).toBe('micro_learning');
    expect(toApiCourseType('ai_lab')).toBe('micro_learning');
  });

  it('returns null for types with no final assessment', () => {
    expect(toApiCourseType('webinar')).toBeNull();
    expect(toApiCourseType('')).toBeNull();
  });
});

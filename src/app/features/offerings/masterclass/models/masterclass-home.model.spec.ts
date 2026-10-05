import { describe, expect, it } from 'vitest';

import { parseHomePage } from '@features/offerings/masterclass/models/masterclass-home.model';
import {
  mockHomePageBody,
  mockMasterclassCourse,
  mockMasterclassTrack,
} from '@testing/mocks/masterclass-home.mock';

describe('parseHomePage', () => {
  it('unwraps the live envelope, extra keys and all', () => {
    // `image_url` is a key the page does not read; it must not fail the parse.
    const track = { ...mockMasterclassTrack('t1', [mockMasterclassCourse('c1')]), image_url: null };

    const page = parseHomePage(mockHomePageBody([track]));

    expect(page.login_type).toBe('pre_login');
    expect(page.tracks).toHaveLength(1);
    expect(page.tracks[0].courses[0].id).toBe('c1');
  });

  it('accepts a track with no courses (the API sends them)', () => {
    const page = parseHomePage(mockHomePageBody([mockMasterclassTrack('t1', [])]));

    expect(page.tracks[0].courses).toEqual([]);
  });

  it('accepts the nulls live UAT sends', () => {
    const course = mockMasterclassCourse('c1', {
      short_description: null,
      trailer_url: null,
      total_cpe_credits: null,
      thumbnails: { horizontal: null, vertical: null, square: null },
    });
    const track = mockMasterclassTrack('t1', [course], { description: null });

    expect(() => parseHomePage(mockHomePageBody([track]))).not.toThrow();
  });

  // The drifts that matter: each one would otherwise render as `undefined`.
  it.each([
    ['a legacy integer course id', { id: 7 }],
    [
      'the Postman spelling cpe_credits',
      { fields_of_study: [{ id: 'f', name: 'IT', cpe_credits: 2 }] },
    ],
    ['credits sent as a string', { total_cpe_credits: '2' }],
    ['a missing title', { title: undefined }],
    ['flat thumbnails', { thumbnails: 'https://example.test/h.png' }],
  ])('rejects a course with %s', (_, overrides) => {
    const track = mockMasterclassTrack('t1', [mockMasterclassCourse('c1', overrides)]);

    expect(() => parseHomePage(mockHomePageBody([track]))).toThrow(/home-page/);
  });

  it.each([
    ['no data', { success: true, message: 'Home page loaded.' }],
    ['data without tracks', { success: true, data: { login_type: 'pre_login' } }],
    ['an unknown login_type', { success: true, data: { login_type: 'guest', tracks: [] } }],
    ['a non-object body', 'Home page loaded.'],
  ])('rejects a body with %s', (_, body) => {
    expect(() => parseHomePage(body)).toThrow(/home-page/);
  });
});

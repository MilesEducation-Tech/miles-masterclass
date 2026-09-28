import { environment } from '@env/environment';
import { isWebinarCard, parseDetail, resolveStatusUrl, WEBINAR_ENDPOINTS } from './webinar.model';

const ROOT = environment.BASE_API_URL;

describe('resolveStatusUrl', () => {
  it('resolves a root-relative path against the API origin', () => {
    expect(resolveStatusUrl('/api/v1/events/register-via-zoom-status/abc/')).toBe(
      `${ROOT}api/v1/events/register-via-zoom-status/abc/`,
    );
  });

  it('passes an absolute URL through when it is the API origin', () => {
    const same = `${ROOT}api/v1/events/register-via-zoom-status/abc/`;
    expect(resolveStatusUrl(same)).toBe(same);
  });

  it('REFUSES a foreign origin and rebuilds the path instead', () => {
    // The whole point: `ApiClient` forwards an absolute URL untouched and
    // `appInterceptor` attaches the learner bearer to it, so following this
    // would hand the token to attacker.example.
    expect(resolveStatusUrl('https://attacker.example/steal/', 'abc')).toBe(
      WEBINAR_ENDPOINTS.registerStatus('abc'),
    );
  });

  it('refuses an unparseable URL the same way', () => {
    expect(resolveStatusUrl('https://[not-a-url', 'abc')).toBe(
      WEBINAR_ENDPOINTS.registerStatus('abc'),
    );
  });

  it('throws rather than following a foreign origin when it cannot rebuild', () => {
    expect(() => resolveStatusUrl('https://attacker.example/steal/')).toThrow(/foreign origin/);
  });
});

/** The contract's §8 card, verbatim apart from the elided `"..."` values. */
const CARD = {
  id: '3f1a9c7e-5b42-4d9a-8f10-2c6be7d41a55',
  slug: 'caira-level-1-orientation',
  name: 'CAIRA Level 1',
  type: 'webinar',
  short_description: '...',
  start_date_time: '2026-09-20T13:00:00+00:00',
  end_date_time: '2026-09-20T14:00:00+00:00',
  duration_seconds: 3600,
  webinar_zoom_id: '84123456789',
  is_test_webinar: false,
  webinar_why_attend_points: [],
  webinar_what_will_you_learn_points: [],
  subject: 'CAIRA',
  subject_details: { id: 'b2c4e1a8-7f39-4c52-9d61-08ab3e7f4d12', subject: 'CAIRA' },
  level_details: {
    level_id: 'd57e0b93-1a46-4f88-ae20-6c91f2b7e034',
    level_number: 1,
    level_name: 'Level 1',
    level_actual_name: 'Foundations of AI for Accountants',
  },
  horizontal_thumbnail: 'https://.../h.png',
  vertical_thumbnail: 'https://.../v.png',
  square_image: 'https://.../s.png',
  fields_of_study: [{ id: 'f1', name: 'Information Technology', cpe_credit: 1.0 }],
  total_cpe_credits: 1.0,
};

describe('isWebinarCard', () => {
  it('accepts the contract example', () => {
    expect(isWebinarCard(CARD)).toBe(true);
  });

  // The contract adds keys without notice; only a rename or retype must fail.
  it('allows an extra key', () => {
    expect(isWebinarCard({ ...CARD, caira_check: true })).toBe(true);
  });

  it('accepts every documented null', () => {
    expect(
      isWebinarCard({
        ...CARD,
        slug: null,
        start_date_time: null,
        end_date_time: null,
        duration_seconds: null,
        webinar_zoom_id: null,
        webinar_why_attend_points: null,
        webinar_what_will_you_learn_points: null,
        subject: null,
        subject_details: null,
        level_details: null,
        total_cpe_credits: null,
      }),
    ).toBe(true);
  });

  // Verified on UAT 2026-09-18, despite the contract typing it as a string.
  it('accepts a null level_actual_name', () => {
    expect(
      isWebinarCard({ ...CARD, level_details: { ...CARD.level_details, level_actual_name: null } }),
    ).toBe(true);
  });

  it.each([
    ['the pre-rename cpe_credits', { total_cpe_credits: undefined, cpe_credits: 1 }],
    ['an unknown type', { type: 'masterclass' }],
    ['a numeric zoom id', { webinar_zoom_id: 84123456789 }],
    ['an image sent as null', { square_image: null }],
    ['a field of study without cpe_credit', { fields_of_study: [{ id: 'f1', name: 'IT' }] }],
  ])('rejects %s', (_, overrides) => {
    expect(isWebinarCard({ ...CARD, ...overrides })).toBe(false);
  });
});

describe('parseDetail', () => {
  const body = (webinar: object) => ({ message: 'ok', data: { login_type: 'pre_login', webinar } });
  const DETAIL = {
    ...CARD,
    description: null,
    trailer_url: null,
    trailer_thumbnail_url: null,
    product: null,
  };

  it('unwraps the webinar from the envelope', () => {
    expect(parseDetail(body(DETAIL)).id).toBe(CARD.id);
  });

  it('throws when a detail-only key is missing', () => {
    const withoutProduct: Record<string, unknown> = { ...DETAIL };
    delete withoutProduct['product'];
    expect(() => parseDetail(body(withoutProduct))).toThrow(/webinar-details-page/);
  });

  it('throws on a body with no data', () => {
    expect(() => parseDetail({ message: 'ok' })).toThrow();
  });
});

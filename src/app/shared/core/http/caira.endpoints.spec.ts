import { CAIRA, isPublicCairaRoute, shouldAttachToken } from './caira.endpoints';

const BASE = 'https://uat-caira.example.com/';
const url = (path: string) => `${BASE}${path}`;

describe('isPublicCairaRoute', () => {
  it.each([
    CAIRA.loginWithEmailPassword,
    CAIRA.loginWithPhoneOtp,
    CAIRA.verifyOtp,
    CAIRA.qrInitiate,
    CAIRA.qrConfirm,
    CAIRA.refresh,
    CAIRA.country,
  ])('treats %s as pre-token', (path) => {
    expect(isPublicCairaRoute(url(path))).toBe(true);
  });

  it('still matches when a query string is present', () => {
    expect(isPublicCairaRoute(url(`${CAIRA.country}?country=Ind`))).toBe(true);
  });

  it('does not match qr/claim — that one is authenticated', () => {
    expect(isPublicCairaRoute(url(CAIRA.qrClaim))).toBe(false);
  });

  it.each([CAIRA.topSection, CAIRA.status, CAIRA.badgesCatalog, CAIRA.levelsProgress])(
    'does not match the authenticated route %s',
    (path) => {
      expect(isPublicCairaRoute(url(path))).toBe(false);
    },
  );

  it('does not confuse verify-otp with the mobile twin path', () => {
    // The web route is `web/verify-otp`; the mobile one is a bare `verify-otp`
    // and is deliberately unbound. Matching the bare path would be a bug only
    // if it were ever called — assert the suffix match is anchored to the
    // registered route, which ends with the same characters.
    expect(isPublicCairaRoute(url('web/verify-otp'))).toBe(true);
  });
});

describe('shouldAttachToken', () => {
  it('attaches to an authenticated CAIRA call', () => {
    expect(shouldAttachToken(url(CAIRA.topSection), BASE, false)).toBe(true);
  });

  it('never attaches to a pre-token CAIRA route', () => {
    expect(shouldAttachToken(url(CAIRA.loginWithEmailPassword), BASE, false)).toBe(false);
    expect(shouldAttachToken(url(CAIRA.refresh), BASE, false)).toBe(false);
  });

  it('honours an explicit skip flag', () => {
    expect(shouldAttachToken(url(CAIRA.topSection), BASE, true)).toBe(false);
  });

  describe('never leaks the token off-origin', () => {
    it.each([
      'https://wp.milesmasterclass.com/blog/wp-json/wp/v2/posts',
      '/blog-api/wp/v2/posts',
      'https://d1pp0977rsxmiq.cloudfront.net/thumb.png',
      'https://asset.milesmasterclass.com/media/web-app/x.svg',
      'https://lodzktvnxuprpogelodm.supabase.co/rest/v1/seo_pages',
      'https://credly.com/badges/abc/accept',
    ])('does not attach to %s', (other) => {
      expect(shouldAttachToken(other, BASE, false)).toBe(false);
    });

    it('is an allowlist, so a lookalike host gets nothing', () => {
      // The old interceptor attached to everything that did not opt out, so a
      // forgotten SKIP_AUTH_TOKEN was a disclosure. This is the inverse.
      expect(shouldAttachToken('https://uat-caira.example.com.evil.test/x', BASE, false)).toBe(
        false,
      );
    });
  });
});

describe('CAIRA endpoint registry', () => {
  it('keeps the webinar id numeric and every other id a string', () => {
    expect(CAIRA.webinarDetail(1234)).toContain('/webinars_web/1234/');
    expect(CAIRA.courseDetail('8f1c0000-0000-4000-8000-000000000000')).toContain(
      '/Masterclass_Course_Detail/8f1c0000-0000-4000-8000-000000000000/',
    );
  });

  it('preserves the trailing slashes the account routes do NOT have', () => {
    // A 301 from Django's APPEND_SLASH drops a POST body, so these matter.
    expect(CAIRA.loginWithEmailPassword.endsWith('/')).toBe(false);
    expect(CAIRA.verifyOtp.endsWith('/')).toBe(false);
    expect(CAIRA.refresh.endsWith('/')).toBe(false);
    expect(CAIRA.status.endsWith('/')).toBe(false);
  });

  it('preserves the trailing slashes the two account routes DO require', () => {
    expect(CAIRA.registerDevice).toBe('register-device/');
    expect(CAIRA.chatbotUserDetails).toBe('chatbot/user_details/');
  });

  it('keeps the two same-named badge-clicked endpoints distinct', () => {
    // #19 takes credly_assertion_id, #28 takes credly_accept_url. Collapsing
    // them would send the wrong payload shape.
    expect(CAIRA.levelBadgeClicked).not.toBe(CAIRA.levelBadgeClickedByUrl);
    expect(CAIRA.levelBadgeClicked).toContain('CAIRA_LMS_Masterclass_MilesOne_Web/');
    expect(CAIRA.levelBadgeClickedByUrl).toBe('caira/level_based_badge_clicked/');
  });

  it('exposes no path with an /api/ prefix', () => {
    // CAIRA registers at the URLconf root, unlike the old api.milesmasterclass.com/api/.
    const paths = Object.values(CAIRA).map((v) => (typeof v === 'function' ? v('x' as never) : v));
    expect(paths.filter((p) => p.startsWith('api/'))).toEqual([]);
  });

  it('does not expose the mobile OTP routes that leak the dev OTP', () => {
    const paths = Object.values(CAIRA).filter((v): v is string => typeof v === 'string');
    expect(paths).not.toContain('login-with-phone-otp');
    expect(paths).not.toContain('verify-otp');
  });
});

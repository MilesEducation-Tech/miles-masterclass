import {
  StatusData,
  isProfileComplete,
  normalizeCountryCode,
  ssoUserToCairaUser,
  toCairaUser,
} from './auth.model';

/** A v2/status payload with every key present, per the reference's 19-key list. */
function statusData(overrides: Partial<StatusData> = {}): StatusData {
  return {
    sso_user_id: 'u-1',
    sso_phone: '9876543210',
    sso_countryCode: '+91',
    sso_profilePicture: 'https://cdn.test/me.png',
    mo_first_name: 'Ada',
    mo_last_name: 'Lovelace',
    mo_full_name: 'Ada Lovelace',
    mo_location: 'Bengaluru',
    mo_email: 'ada@example.com',
    mo_education: { text: 'BSc', value: ['2019'] },
    mo_pathway: 'Yes',
    mo_tags: ['CPA'],
    mo_professional_qualification: [],
    mo_work_experience: '2-5',
    mo_career_path: [],
    mo_learning_pathway: ['CAIRA'],
    mo_ai_readiness: 'Beginner',
    mo_email_verified: true,
    is_test_user: false,
    ...overrides,
  };
}

describe('normalizeCountryCode', () => {
  it('adds the missing + that #33 omits', () => {
    // Same account reports "91" from login-with-email-password and "+91" from
    // verify-otp. Without this the two never compare equal.
    expect(normalizeCountryCode('91')).toBe('+91');
  });

  it('leaves an already-prefixed code alone', () => {
    expect(normalizeCountryCode('+91')).toBe('+91');
  });

  it.each([null, undefined, '', '   '])('maps %p to an empty string', (input) => {
    expect(normalizeCountryCode(input)).toBe('');
  });
});

describe('toCairaUser', () => {
  it('maps the mo_/sso_ prefixed payload onto the app shape', () => {
    const user = toCairaUser(statusData());
    expect(user).toMatchObject({
      userId: 'u-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '9876543210',
      countryCode: '+91',
      location: 'Bengaluru',
      emailVerified: true,
      isTestUser: false,
    });
  });

  it('composes a full name when the server sends none', () => {
    expect(toCairaUser(statusData({ mo_full_name: null })).fullName).toBe('Ada Lovelace');
  });

  it('coerces a blank avatar to null so ngSrc never sees an empty string', () => {
    // Binding ngSrc="" throws NG02952 and kills the render.
    expect(toCairaUser(statusData({ sso_profilePicture: '' })).profilePicture).toBeNull();
    expect(toCairaUser(statusData({ sso_profilePicture: null })).profilePicture).toBeNull();
  });

  it('never yields a null array, whatever the server sends', () => {
    const user = toCairaUser(
      statusData({ mo_tags: null, mo_career_path: null, mo_learning_pathway: null }),
    );
    expect(user.tags).toEqual([]);
    expect(user.careerPath).toEqual([]);
    expect(user.learningPathway).toEqual([]);
  });

  it('treats a non-true email_verified as unverified', () => {
    expect(toCairaUser(statusData({ mo_email_verified: null })).emailVerified).toBe(false);
  });

  it('trims whitespace-only names to empty rather than carrying them', () => {
    const user = toCairaUser(statusData({ mo_first_name: '  ', mo_last_name: '  ' }));
    expect(user.firstName).toBe('');
    expect(user.lastName).toBe('');
  });
});

describe('ssoUserToCairaUser', () => {
  it('normalises the unprefixed country code #33 returns', () => {
    const user = ssoUserToCairaUser({
      userId: 'u-1',
      phone: '9876543210',
      countryCode: '91',
      firstName: 'Ada',
      lastName: 'Lovelace',
      profilePicture: null,
    });
    expect(user.countryCode).toBe('+91');
    expect(user.fullName).toBe('Ada Lovelace');
  });

  it('leaves email blank — the login payload never carries one', () => {
    const user = ssoUserToCairaUser({
      userId: 'u-1',
      phone: null,
      countryCode: null,
      firstName: 'Ada',
      lastName: null,
      profilePicture: null,
    });
    expect(user.email).toBe('');
    // …which means a login-seeded user is deliberately "incomplete" until
    // v2/status fills it in. See the guard note below.
    expect(isProfileComplete(user)).toBe(false);
  });
});

describe('isProfileComplete', () => {
  it('accepts a profile with a first name, full name and email', () => {
    expect(isProfileComplete(toCairaUser(statusData()))).toBe(true);
  });

  it.each([
    ['no email', { mo_email: null }],
    ['no first name', { mo_first_name: null, mo_full_name: null }],
    ['blank email', { mo_email: '   ' }],
  ])('rejects a profile with %s', (_label, overrides) => {
    expect(isProfileComplete(toCairaUser(statusData(overrides as Partial<StatusData>)))).toBe(
      false,
    );
  });

  it('rejects a null user', () => {
    expect(isProfileComplete(null)).toBe(false);
  });
});

import { AppStatusResponse, appStatusVerdict } from './app-status.model';

describe('appStatusVerdict', () => {
  it('reads an all-true response as the happy learner', () => {
    // The polarity trap: these names read like problems and mean the opposite.
    expect(
      appStatusVerdict({
        is_web_maintenance: true,
        is_pathway: true,
        is_onboarding_completed: true,
      }),
    ).not.toBe('ok');
    expect(
      appStatusVerdict({
        is_web_maintenance: false,
        is_pathway: true,
        is_onboarding_completed: true,
      }),
    ).toBe('ok');
  });

  it('does not block on missing keys', () => {
    // A partial response must not lock every learner out.
    expect(appStatusVerdict({})).toBe('ok');
    expect(appStatusVerdict(undefined)).toBe('ok');
    expect(appStatusVerdict({ is_pathway: true })).toBe('ok');
  });

  it('ignores the mobile maintenance flag', () => {
    // `is_maintenance` is the app-store window; the web LMS is unaffected.
    expect(appStatusVerdict({ is_maintenance: true })).toBe('ok');
  });

  it('gates on the web maintenance flag', () => {
    expect(appStatusVerdict({ is_web_maintenance: true })).toBe('maintenance');
  });

  it('puts maintenance ahead of pathway and onboarding', () => {
    const status: AppStatusResponse = {
      is_web_maintenance: true,
      is_pathway: false,
      is_onboarding_completed: false,
    };
    expect(appStatusVerdict(status)).toBe('maintenance');
  });

  it('puts pathway ahead of onboarding', () => {
    expect(appStatusVerdict({ is_pathway: false, is_onboarding_completed: false })).toBe(
      'needs-pathway',
    );
  });

  it('reports onboarding last', () => {
    expect(appStatusVerdict({ is_pathway: true, is_onboarding_completed: false })).toBe(
      'needs-onboarding',
    );
  });
});

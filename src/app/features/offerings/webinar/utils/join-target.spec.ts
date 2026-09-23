import { environment } from '@env/environment';
import { WebinarCard, WebinarRegistrationInfo } from '../models/webinar.model';
import { resolveJoinTarget } from './join-target';

function registration(overrides: Partial<WebinarRegistrationInfo> = {}): WebinarRegistrationInfo {
  return {
    status: 'SUCCESS',
    registration_status: 'REGISTERED',
    attempt_id: 'a1',
    join_url: 'https://us06web.zoom.us/w/8412345?tk=abc',
    error_code: null,
    error_message: null,
    zoom_attempts: 1,
    completed_at: null,
    route_to_web_lms: true,
    ...overrides,
  };
}

function card(registrationInfo?: WebinarRegistrationInfo): WebinarCard {
  return { id: 'w1', registration: registrationInfo } as unknown as WebinarCard;
}

describe('resolveJoinTarget', () => {
  const liveEnabled = environment.WEBINAR.liveEnabled;

  afterEach(() => {
    (environment.WEBINAR as { liveEnabled: boolean }).liveEnabled = liveEnabled;
  });

  function setLiveEnabled(value: boolean): void {
    (environment.WEBINAR as { liveEnabled: boolean }).liveEnabled = value;
  }

  it('uses the embedded page only when the flag AND the row agree', () => {
    setLiveEnabled(true);
    expect(resolveJoinTarget(card(registration()))).toEqual({ kind: 'embedded' });
  });

  it('falls back to Zoom when the ship flag is off, even if the row says web-LMS', () => {
    // The guard that matters: `attendance-session/*` and `meeting-sdk-signature`
    // are not in the API contract, so the embedded page cannot work yet.
    setLiveEnabled(false);
    expect(resolveJoinTarget(card(registration({ route_to_web_lms: true })))).toEqual({
      kind: 'external',
      url: 'https://us06web.zoom.us/w/8412345?tk=abc',
    });
  });

  it('falls back to Zoom when the row opts out, even with the flag on', () => {
    setLiveEnabled(true);
    expect(resolveJoinTarget(card(registration({ route_to_web_lms: false })))).toEqual({
      kind: 'external',
      url: 'https://us06web.zoom.us/w/8412345?tk=abc',
    });
  });

  it('is unavailable when there is no join url to fall back to', () => {
    setLiveEnabled(false);
    expect(resolveJoinTarget(card(registration({ join_url: null })))).toEqual({
      kind: 'unavailable',
    });
  });

  it('is unavailable with no registration block at all (pre-login, or a past bucket)', () => {
    expect(resolveJoinTarget(card(undefined))).toEqual({ kind: 'unavailable' });
    expect(resolveJoinTarget(null)).toEqual({ kind: 'unavailable' });
  });
});

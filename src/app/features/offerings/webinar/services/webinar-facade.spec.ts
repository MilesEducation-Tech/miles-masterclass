import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClient } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Dialog } from '@core/services/dialog/dialog';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { ServerClock } from '../utils/server-clock';
import { WebinarFacade } from './webinar-facade';
import { WebinarRegistration } from './webinar-registration';

/**
 * The sign-in gate on `register()`.
 *
 * The rest of the facade is resource wiring that only says anything useful
 * against a live API; this branch is a real decision with a security-adjacent
 * consequence — posting `register-via-zoom` without a token is a 401 the
 * learner cannot act on — so it is the part worth pinning.
 */
describe('WebinarFacade.register — sign-in gate', () => {
  const isAuthenticated = signal(false);
  let registerSpy: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let afterClosed: Subject<{ action?: string; result: boolean } | undefined>;
  let facade: WebinarFacade;

  beforeEach(() => {
    isAuthenticated.set(false);
    registerSpy = vi.fn().mockResolvedValue({ result: 'registered' });
    afterClosed = new Subject();
    dialogOpen = vi.fn().mockReturnValue({ afterClosed$: afterClosed.asObservable() });
    navigate = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ServerClock,
        WebinarFacade,
        { provide: AuthSession, useValue: { isAuthenticated } },
        {
          provide: WebinarRegistration,
          useValue: {
            register: registerSpy,
            inFlight: signal(new Set()),
            isRegistering: () => false,
          },
        },
        { provide: Dialog, useValue: { open: dialogOpen } },
        { provide: Router, useValue: { navigate, url: '/us/cpa/webinar/w1' } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(new Map()),
            snapshot: { queryParamMap: new Map([['get', null]]) },
          },
        },
        { provide: ApiClient, useValue: { get: () => of({ data: null }), post: () => of({}) } },
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        {
          provide: NotificationService,
          useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
        },
      ],
    });
    facade = TestBed.inject(WebinarFacade);
  });

  it('does NOT call the registration API when signed out', async () => {
    await facade.register('w1');

    expect(registerSpy).not.toHaveBeenCalled();
    expect(dialogOpen).toHaveBeenCalledTimes(1);
  });

  it('sends the learner back to the webinar they came from after signing in', async () => {
    await facade.register('w1');
    afterClosed.next({ action: 'confirm', result: true });

    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { redirect: '/us/cpa/webinar/w1' },
    });
  });

  it('does not navigate when the learner dismisses the prompt', async () => {
    await facade.register('w1');
    afterClosed.next({ action: 'cancel', result: false });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('registers directly when signed in, with no dialog', async () => {
    isAuthenticated.set(true);

    await facade.register('w1');

    expect(registerSpy).toHaveBeenCalledWith('w1');
    expect(dialogOpen).not.toHaveBeenCalled();
  });
});

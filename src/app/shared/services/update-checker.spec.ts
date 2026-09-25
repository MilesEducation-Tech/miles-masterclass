import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';

import { APP_VERSION } from '@core/version/app-version';
import { Dialog } from '@core/services/dialog/dialog';
import { UpdateChecker } from './update-checker';

/**
 * These tests exist for one specific near-miss.
 *
 * `/version.json` reports BOTH a SemVer `version` (e.g. "3.0.1") and a `buildId`
 * (`sha.timestamp`). Only `buildId` is comparable to the baked-in `APP_VERSION`.
 * Comparing `version` instead mismatches on every single check, which shows every
 * user a non-closeable update dialog forever — and nothing else in the suite
 * would notice. See docs/engineering/versioning.md §3.
 */
describe('UpdateChecker', () => {
  let events: Subject<unknown>;
  let open: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  /** Resolve the one `/version.json` fetch with this body. */
  function serve(body: unknown): void {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
  }

  /** Trigger a check the way the app does, via a navigation. */
  async function navigate(): Promise<void> {
    events.next(new NavigationEnd(1, '/', '/'));
    // A macrotask, not a microtask: the dialog is `import()`ed lazily, so the
    // chain is fetch -> json -> dynamic import -> open, and awaiting a couple of
    // resolved promises lands short of it.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** The dialog opens behind a dynamic import; give it a moment to arrive. */
  function expectPrompted(): Promise<void> {
    return vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
  }

  beforeEach(() => {
    events = new Subject();
    open = vi.fn();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({
      providers: [
        UpdateChecker,
        { provide: Router, useValue: { events } },
        { provide: Dialog, useValue: { open } },
        {
          provide: DOCUMENT,
          useValue: { addEventListener: vi.fn(), visibilityState: 'visible' },
        },
      ],
    });

    TestBed.inject(UpdateChecker).init();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not prompt when the deployed buildId matches the running one', async () => {
    serve({ version: '3.0.1', sha: 'abc1234', buildId: APP_VERSION });
    await navigate();
    expect(open).not.toHaveBeenCalled();
  });

  it('prompts when the deployed buildId differs', async () => {
    serve({ version: '3.0.1', sha: 'def5678', buildId: 'def5678.9999999999999' });
    await navigate();
    await expectPrompted();
  });

  // The regression guard: a payload whose SemVer is unrelated to APP_VERSION but
  // whose buildId matches must stay silent. Reading `version` here would prompt.
  it('ignores the SemVer field entirely', async () => {
    serve({ version: '9.9.9', sha: 'abc1234', buildId: APP_VERSION });
    await navigate();
    expect(open).not.toHaveBeenCalled();
  });

  it('does nothing when buildId is absent', async () => {
    serve({ version: '3.0.1' });
    await navigate();
    expect(open).not.toHaveBeenCalled();
  });

  it('prompts once, not once per navigation', async () => {
    serve({ version: '3.0.1', buildId: 'other.1' });
    await navigate();
    await expectPrompted();
    await navigate();
    await navigate();
    expect(open).toHaveBeenCalledTimes(1);
  });
});

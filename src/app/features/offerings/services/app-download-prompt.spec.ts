import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDownloadPrompt } from './app-download-prompt';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Viewport } from '@core/services/viewport/viewport';

describe('AppDownloadPrompt', () => {
  const isMobile = signal(true);
  let dialogOpen: ReturnType<typeof vi.fn>;
  let service: AppDownloadPrompt;

  beforeEach(() => {
    sessionStorage.removeItem('app_download_prompted');
    isMobile.set(true);
    dialogOpen = vi.fn();
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        { provide: Viewport, useValue: { isMobile } },
        { provide: NgpDialogManager, useValue: { open: dialogOpen } },
      ],
    });
    service = TestBed.inject(AppDownloadPrompt);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (navigator as { getInstalledRelatedApps?: unknown }).getInstalledRelatedApps;
    sessionStorage.removeItem('app_download_prompted');
  });

  it('opens the dialog once per session on mobile', async () => {
    service.maybePrompt();
    await vi.advanceTimersByTimeAsync(1001);
    expect(dialogOpen).toHaveBeenCalledTimes(1);

    service.maybePrompt();
    await vi.advanceTimersByTimeAsync(1001);
    expect(dialogOpen).toHaveBeenCalledTimes(1);
  });

  it('does nothing on desktop', async () => {
    isMobile.set(false);
    service.maybePrompt();
    await vi.advanceTimersByTimeAsync(1001);
    expect(dialogOpen).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('app_download_prompted')).toBeNull();
  });

  it('skips the dialog when the app is reported installed', async () => {
    (navigator as { getInstalledRelatedApps?: unknown }).getInstalledRelatedApps = () =>
      Promise.resolve([{ platform: 'play', id: 'com.miles.masterclass' }]);

    service.maybePrompt();
    await vi.advanceTimersByTimeAsync(1001);
    expect(dialogOpen).not.toHaveBeenCalled();
  });
});

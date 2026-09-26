import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { createDefaultSeoPage, SeoPage } from '@core/models/seo.models';
import { Logger } from '@core/services/logger/logger';
import { SupabaseSeo } from '@core/services/seo/supabase-seo';
import { SeoDashboard } from './seo-dashboard';

const page = (id: string, slug: string): SeoPage => ({
  ...createDefaultSeoPage(slug, slug, 'static'),
  id,
});

describe('SeoDashboard load', () => {
  let seo: {
    getAll: ReturnType<typeof vi.fn>;
    seedDefaults: ReturnType<typeof vi.fn>;
    deleteById: ReturnType<typeof vi.fn>;
  };

  const create = async () => {
    const fixture = TestBed.createComponent(SeoDashboard);
    await fixture.whenStable();
    return fixture.componentInstance;
  };

  beforeEach(() => {
    seo = { getAll: vi.fn(), seedDefaults: vi.fn(), deleteById: vi.fn() };
    TestBed.overrideTemplate(SeoDashboard, '');
    TestBed.configureTestingModule({
      imports: [SeoDashboard],
      providers: [
        provideRouter([]),
        { provide: SupabaseSeo, useValue: seo },
        {
          provide: Logger,
          useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        },
        {
          provide: NgpDialogManager,
          useValue: {
            open: () => ({ afterClosed: of({ action: 'confirm', result: true }) }),
          },
        },
      ],
    });
  });

  it('loads the pages and does not seed a table that has rows', async () => {
    seo.getAll.mockResolvedValue([page('1', 'home'), page('2', 'faq')]);
    const cmp = await create();

    expect(cmp.pages().map((p) => p.page_slug)).toEqual(['home', 'faq']);
    expect(cmp.loading()).toBe(false);
    expect(cmp.loadError()).toBeNull();
    expect(seo.seedDefaults).not.toHaveBeenCalled();
  });

  it('seeds an empty table, then shows the re-read rows', async () => {
    seo.getAll.mockResolvedValueOnce([]).mockResolvedValueOnce([page('1', 'home')]);
    seo.seedDefaults.mockResolvedValue([page('1', 'home')]);
    const cmp = await create();

    expect(seo.seedDefaults).toHaveBeenCalledTimes(1);
    expect(cmp.pages().map((p) => p.page_slug)).toEqual(['home']);
  });

  it('shows the configuration error when seeding fails, and Retry loads again', async () => {
    seo.getAll.mockResolvedValue([]);
    seo.seedDefaults.mockResolvedValue(null);
    const cmp = await create();

    expect(cmp.loadError()).toContain('Supabase configuration');
    expect(cmp.pages()).toEqual([]);

    seo.getAll.mockResolvedValue([page('3', 'about')]);
    cmp.loadPages();
    await new Promise((resolve) => setTimeout(resolve));
    expect(cmp.pages().map((p) => p.page_slug)).toEqual(['about']);
    expect(cmp.loadError()).toBeNull();
  });

  it('removes a deleted page in place, without a reload', async () => {
    seo.getAll.mockResolvedValue([page('1', 'home'), page('2', 'faq')]);
    seo.deleteById.mockResolvedValue(true);
    const cmp = await create();

    await cmp.deletePage(page('2', 'faq'));
    expect(cmp.pages().map((p) => p.page_slug)).toEqual(['home']);
    expect(seo.getAll).toHaveBeenCalledTimes(1);
  });
});

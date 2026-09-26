import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { createDefaultSeoPage, SeoPage } from '@core/models/seo.models';
import { Logger } from '@core/services/logger/logger';
import { SupabaseSeo } from '@core/services/seo/supabase-seo';
import { AdminAuth } from '@admin/core/services/admin-auth';
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

describe('SeoDashboard create-page dialog', () => {
  let el: HTMLElement;
  let cmp: SeoDashboard;

  const wait = async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await TestBed.inject(ApplicationRef).whenStable();
  };
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SeoDashboard],
      providers: [
        provideRouter([]),
        {
          provide: SupabaseSeo,
          useValue: {
            getAll: vi.fn().mockResolvedValue([]),
            seedDefaults: vi.fn().mockResolvedValue([]),
          },
        },
        { provide: AdminAuth, useValue: { hasPermission: () => true, hasAny: () => true } },
        {
          provide: Logger,
          useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(SeoDashboard);
    el = fixture.nativeElement;
    document.body.appendChild(el);
    cmp = fixture.componentInstance;
    await wait();
  });

  afterEach(() => {
    cmp.closeCreateModal();
    el.remove();
  });

  it('opens a modal dialog whose panel keeps the admin theme', async () => {
    cmp.openCreateModal();
    await wait();

    const d = dialog()!;
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-label')).toBe('Create New Page');
    // Attached to <body>, outside the layout, so the panel must carry the theme itself.
    expect(d.querySelector('.admin-theme')).not.toBeNull();
    expect(d.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', async () => {
    cmp.openCreateModal();
    await wait();
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await wait();

    expect(dialog()).toBeNull();
  });
});

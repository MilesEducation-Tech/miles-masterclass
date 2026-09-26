import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSeoPage } from '@core/models/seo.models';
import { Logger } from '@core/services/logger/logger';
import { SupabaseSeo } from '@core/services/seo/supabase-seo';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { SeoEditor } from './seo-editor';

describe('SeoEditor load', () => {
  let getBySlug: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<SeoEditor>;

  const open = async (slug: string) => {
    fixture = TestBed.createComponent(SeoEditor);
    fixture.componentRef.setInput('slug', slug);
    await fixture.whenStable();
    return fixture.componentInstance;
  };

  beforeEach(() => {
    getBySlug = vi.fn();
    TestBed.overrideTemplate(SeoEditor, '');
    TestBed.configureTestingModule({
      imports: [SeoEditor],
      providers: [
        provideRouter([]),
        { provide: SupabaseSeo, useValue: { getBySlug } },
        { provide: AdminAuth, useValue: { adminUser: signal(null) } },
        {
          provide: Logger,
          useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        },
      ],
    });
  });

  it('loads the row for the decoded slug and fills the form from it', async () => {
    getBySlug.mockResolvedValue({
      ...createDefaultSeoPage('us/cpa/faq', 'FAQ', 'static'),
      title: 'FAQ | Miles',
    });
    const cmp = await open(encodeURIComponent('us/cpa/faq'));

    expect(getBySlug).toHaveBeenCalledWith('us/cpa/faq');
    expect(cmp.loading()).toBe(false);
    expect(cmp.form.value.title).toBe('FAQ | Miles');
    expect(cmp.page()?.page_slug).toBe('us/cpa/faq');
  });

  it('starts a default row when the slug has none yet', async () => {
    getBySlug.mockResolvedValue(null);
    const cmp = await open('new-page');

    expect(cmp.page()?.page_slug).toBe('new-page');
    expect(cmp.loading()).toBe(false);
  });

  it('does not re-fill the form while the user edits it', async () => {
    getBySlug.mockResolvedValue({
      ...createDefaultSeoPage('faq', 'FAQ', 'static'),
      title: 'Original',
    });
    const cmp = await open('faq');

    cmp.form.patchValue({ title: 'Typed by the user' });
    // The preview writes `page` on (debounced) form changes; that must not reach the form.
    // A different title than the form holds, so a re-fill from `page` would show.
    cmp.page.update((p) => (p ? { ...p, title: 'Written by the preview' } : p));
    await fixture.whenStable();

    expect(cmp.form.value.title).toBe('Typed by the user');
    expect(getBySlug).toHaveBeenCalledTimes(1);
  });
});

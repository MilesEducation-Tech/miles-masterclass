import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('SeoEditor section tabs and field tips', () => {
  let fixture: ComponentFixture<SeoEditor>;
  let el: HTMLElement;
  const wait = async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await fixture.whenStable();
  };
  const tab = (text: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]')).find((t) =>
      t.textContent?.includes(text),
    )!;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SeoEditor],
      providers: [
        provideRouter([]),
        {
          provide: SupabaseSeo,
          useValue: { getBySlug: vi.fn().mockResolvedValue(null) },
        },
        { provide: AdminAuth, useValue: { adminUser: signal(null) } },
        {
          provide: Logger,
          useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        },
      ],
    });
    fixture = TestBed.createComponent(SeoEditor);
    fixture.componentRef.setInput('slug', 'faq');
    el = fixture.nativeElement;
    document.body.appendChild(el);
    await wait();
  });

  afterEach(() => el.remove());

  it('is a labelled tablist whose selected tab controls the rendered panel', async () => {
    expect(el.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('SEO sections');
    expect(tab('Basic SEO').getAttribute('aria-selected')).toBe('true');

    tab('Open Graph').click();
    await wait();

    expect(tab('Open Graph').getAttribute('aria-selected')).toBe('true');
    const panel = el.querySelector('[role="tabpanel"]')!;
    expect(panel.id).toBe(tab('Open Graph').getAttribute('aria-controls'));
    expect(panel.getAttribute('aria-labelledby')).toBe(tab('Open Graph').id);
  });

  it('shows a field tip on keyboard focus and links it with aria-describedby', async () => {
    const trigger = el.querySelector<HTMLElement>('[aria-label="More info"]')!;
    expect(trigger.tabIndex).toBe(0);

    trigger.dispatchEvent(new FocusEvent('focus'));
    await wait();

    const tip = document.querySelector('[role="tooltip"]')!;
    expect(tip.textContent).toContain('clickable blue link in Google');
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.id);
  });
});

import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowUpTray,
  heroCheckCircle,
  heroCodeBracket,
  heroDocument,
  heroDocumentText,
  heroExclamationCircle,
  heroInformationCircle,
  heroMagnifyingGlass,
  heroPencilSquare,
  heroPlus,
  heroTrash,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { UtilsDialog, UtilsDialogData } from '@shared/dialogs/utils-dialog/utils-dialog';
import { computeSeoScore, createDefaultSeoPage, SeoPage } from '@core/models/seo.models';
import { Dialog } from '@core/services/dialog/dialog';
import { Logger } from '@core/services/logger/logger';
import { SupabaseSeo } from '@core/services/seo/supabase-seo';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { AriaSelect } from '@shared/ui/aria/aria-select/aria-select';
import { Button } from '@shared/ui/button/button';
import { AriaSelectOption } from '@core/models/aria.model';
import { PERM } from '@admin/core/models/admin-rbac.model';
import { HasPermissionDirective } from '@admin/core/directives/has-permission';

@Component({
  selector: 'app-seo-dashboard',
  imports: [NgIconComponent, RouterLink, HasPermissionDirective, AriaInput, AriaSelect, Button],
  providers: [
    provideIcons({
      heroMagnifyingGlass,
      heroDocumentText,
      heroCheckCircle,
      heroExclamationCircle,
      heroDocument,
      heroCodeBracket,
      heroPencilSquare,
      heroTrash,
      heroInformationCircle,
      heroPlus,
      heroXMark,
      heroArrowUpTray,
    }),
  ],
  templateUrl: './seo-dashboard.html',
})
export class SeoDashboard implements OnInit {
  protected readonly PERM = PERM;
  private readonly supabaseSeo = inject(SupabaseSeo);
  private readonly router = inject(Router);
  private readonly logger = inject(Logger);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly pages = signal<SeoPage[]>([]);
  readonly loading = signal(true);
  /** Surfaced to the template so misconfig/network errors aren't silent. */
  readonly loadError = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly filterType = signal<'all' | 'static' | 'dynamic'>('all');
  protected readonly filterOptions: AriaSelectOption<'all' | 'static' | 'dynamic'>[] = [
    { value: 'all', label: 'All Types' },
    { value: 'static', label: 'Static Pages' },
    { value: 'dynamic', label: 'Dynamic Pages' },
  ];
  protected readonly pageTypeOptions: AriaSelectOption<'static' | 'dynamic'>[] = [
    { value: 'static', label: 'Static Route' },
    { value: 'dynamic', label: 'Dynamic Route (e.g. contains :id)' },
  ];

  readonly filteredPages = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const type = this.filterType();
    return this.pages().filter((p) => {
      const matchesSearch =
        !query ||
        p.page_name.toLowerCase().includes(query) ||
        p.page_slug.toLowerCase().includes(query);
      const matchesType = type === 'all' || p.page_type === type;
      return matchesSearch && matchesType;
    });
  });

  readonly stats = computed(() => {
    const all = this.pages();
    const scores = all.map((p) => computeSeoScore(p));
    const excellent = scores.filter((s) => s >= 80).length;
    const needsWork = scores.filter((s) => s >= 40 && s < 80).length;
    const poor = scores.filter((s) => s < 40).length;
    const avgScore =
      all.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / all.length) : 0;
    return { total: all.length, excellent, needsWork, poor, avgScore };
  });

  readonly computeSeoScore = computeSeoScore;

  readonly showCreateModal = signal(false);
  readonly newPageName = signal('');
  readonly newPageSlug = signal('');
  readonly newPageType = signal<'static' | 'dynamic'>('static');
  readonly creatingPage = signal(false);
  readonly createError = signal<string | null>(null);

  openCreateModal(): void {
    this.newPageName.set('');
    this.newPageSlug.set('');
    this.newPageType.set('static');
    this.createError.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  async createNewPage(): Promise<void> {
    const name = this.newPageName().trim();
    let slug = this.newPageSlug().trim();
    const type = this.newPageType();

    if (!name || !slug) return;

    if (slug.startsWith('/')) slug = slug.substring(1);

    this.creatingPage.set(true);
    this.createError.set(null);
    const newPage = createDefaultSeoPage(slug, name, type);
    const result = await this.supabaseSeo.upsert(newPage);

    this.creatingPage.set(false);
    if (result) {
      this.logger.info(`[SeoDashboard] Created new page: ${slug}`);
      this.closeCreateModal();
      this.router.navigate(['/admin', 'seo', 'edit', encodeURIComponent(slug)]);
    } else {
      this.logger.error(`[SeoDashboard] Failed to create new page: ${slug}`);
      this.createError.set('Failed to create page. The slug might already exist.');
    }
  }

  ngOnInit(): void {
    this.loadPages();
  }

  async loadPages(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    let data = await this.supabaseSeo.getAll();

    // Seed defaults only if table is completely empty.
    if (data.length === 0) {
      const seeded = await this.supabaseSeo.seedDefaults();
      if (seeded === null) {
        this.loadError.set(
          'Could not load SEO pages. Check your Supabase configuration and try again.',
        );
        this.loading.set(false);
        return;
      }
      data = await this.supabaseSeo.getAll();
    }

    this.logger.info(`[SeoDashboard] Loaded ${data.length} SEO pages`);
    this.pages.set(data);
    this.loading.set(false);
  }

  editPage(page: SeoPage): void {
    this.logger.debug(`[SeoDashboard] Navigating to edit page: ${page.page_slug}`);
    this.router.navigate(['/admin', 'seo', 'edit', encodeURIComponent(page.page_slug)]);
  }

  async deletePage(page: SeoPage): Promise<void> {
    if (!page.id) return;

    const confirmed = await this.confirmDelete(page);
    if (!confirmed) return;

    this.logger.warn(`[SeoDashboard] Attempting to delete page: ${page.page_slug}`);
    const success = await this.supabaseSeo.deleteById(page.id);
    if (success) {
      this.logger.info(`[SeoDashboard] Successfully deleted page: ${page.page_slug}`);
      this.pages.update((prev) => prev.filter((p) => p.id !== page.id));
    } else {
      this.logger.error(`[SeoDashboard] Failed to delete page: ${page.page_slug}`);
    }
  }

  private confirmDelete(page: SeoPage): Promise<boolean> {
    const data: UtilsDialogData = {
      title: `Delete "${page.page_name}"?`,
      containerClass: 'max-w-md',
      content: [
        {
          type: 'text',
          value: `This will permanently delete the SEO settings for "${page.page_name}". This cannot be undone.`,
        },
      ],
      buttons: [
        { label: 'Cancel', variant: 'outline', action: 'cancel' },
        { label: 'Delete', variant: 'destructive', action: 'confirm' },
      ],
    };
    const ref = this.dialog.open<UtilsDialog, { action?: string; result: boolean }>(UtilsDialog, {
      data,
      maxWidth: '32rem',
    });
    return new Promise<boolean>((resolve) => {
      ref.afterClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((res) => {
        resolve(res?.action === 'confirm' && res?.result === true);
      });
    });
  }

  async toggleActive(page: SeoPage): Promise<void> {
    const updated = { ...page, is_active: !page.is_active };
    const result = await this.supabaseSeo.upsert(updated);
    if (result) {
      this.logger.info(
        `[SeoDashboard] Toggled active status for ${page.page_slug} to ${updated.is_active}`,
      );
      this.pages.update((prev) =>
        prev.map((p) => (p.id === page.id ? { ...p, is_active: !p.is_active } : p)),
      );
    } else {
      this.logger.error(`[SeoDashboard] Failed to toggle active status for ${page.page_slug}`);
    }
  }

  getScoreClass(score: number): { badge: string; text: string; bar: string } {
    if (score >= 80) {
      return {
        badge: 'bg-emerald-500/15 text-emerald-400',
        text: 'text-emerald-400',
        bar: 'bg-emerald-500',
      };
    }
    if (score >= 40) {
      return {
        badge: 'bg-amber-500/15 text-amber-400',
        text: 'text-amber-400',
        bar: 'bg-amber-500',
      };
    }
    return {
      badge: 'bg-red-500/15 text-red-400',
      text: 'text-red-400',
      bar: 'bg-red-500',
    };
  }

  getScoreLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 40) return 'Needs Work';
    return 'Poor';
  }

  onSearchInput(value: unknown): void {
    this.searchQuery.set(typeof value === 'string' ? value : '');
  }

  onFilterChange(value: 'all' | 'static' | 'dynamic' | null): void {
    this.filterType.set(value ?? 'all');
  }
}

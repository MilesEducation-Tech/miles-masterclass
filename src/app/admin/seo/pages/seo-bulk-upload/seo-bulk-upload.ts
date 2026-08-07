import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroArrowUpTray,
  heroDocumentArrowDown,
  heroExclamationCircle,
  heroTrash,
} from '@ng-icons/heroicons/outline';
import { SeoPageType } from '../../../../shared/core/models/seo.constants';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../shared/core/services/notification/notification';
import { SupabaseSeo } from '../../../../shared/core/services/seo/supabase-seo';
import { saveBlob } from '../../../../shared/utils/blob-download';
import {
  parseSeoCsv,
  SEO_CSV_TEMPLATE,
  SeoRow,
  validateSeoRow,
} from '../../../../shared/utils/seo/seo-csv';

/** Editable text fields exposed as plain inputs in the preview grid. */
type EditableTextField = 'page_slug' | 'page_name' | 'title' | 'description' | 'canonical_url';

@Component({
  selector: 'app-seo-bulk-upload',
  imports: [RouterLink, NgIconComponent],
  providers: [
    provideIcons({
      heroArrowLeft,
      heroArrowUpTray,
      heroDocumentArrowDown,
      heroExclamationCircle,
      heroTrash,
    }),
  ],
  templateUrl: './seo-bulk-upload.html',
})
export class SeoBulkUpload implements OnInit {
  private readonly supabaseSeo = inject(SupabaseSeo);
  private readonly router = inject(Router);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);

  readonly rows = signal<SeoRow[]>([]);
  readonly importing = signal(false);
  readonly importError = signal<string | null>(null);
  readonly fileName = signal<string | null>(null);
  /** Slugs already in the table — drives the New vs Overwrite badge. */
  private readonly existingSlugs = signal<Set<string>>(new Set());

  readonly summary = computed(() => {
    const rows = this.rows();
    const existing = this.existingSlugs();
    let valid = 0;
    let overwrite = 0;
    let newCount = 0;
    for (const row of rows) {
      if (row.error) continue;
      valid++;
      if (existing.has(row.page.page_slug)) overwrite++;
      else newCount++;
    }
    return {
      total: rows.length,
      valid,
      invalid: rows.length - valid,
      overwrite,
      new: newCount,
    };
  });

  readonly canImport = computed(() => this.summary().valid > 0 && !this.importing());

  async ngOnInit(): Promise<void> {
    const pages = await this.supabaseSeo.getAll();
    this.existingSlugs.set(new Set(pages.map((p) => p.page_slug)));
  }

  isExisting(slug: string): boolean {
    return this.existingSlugs().has(slug);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importError.set(null);
    this.fileName.set(file.name);
    try {
      const text = await file.text();
      const rows = parseSeoCsv(text);
      this.rows.set(rows);
      if (rows.length === 0) {
        this.importError.set('No data rows found in the file.');
      }
      this.logger.info(`[SeoBulkUpload] Parsed ${rows.length} rows from ${file.name}`);
    } catch (err) {
      this.logger.error('[SeoBulkUpload] Failed to read file:', err);
      this.importError.set('Could not read the file. Make sure it is a valid CSV.');
    } finally {
      // Allow re-selecting the same file after a fix.
      input.value = '';
    }
  }

  downloadTemplate(): void {
    saveBlob(new Blob([SEO_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }), 'seo-template.csv');
  }

  updateText(index: number, field: EditableTextField, value: string): void {
    this.patchRow(index, (row) => {
      row.page[field] = field === 'page_slug' ? value.trim().replace(/^\//, '') : value;
    });
  }

  updateKeywords(index: number, value: string): void {
    this.patchRow(index, (row) => {
      row.page.keywords = value
        .split('|')
        .map((k) => k.trim())
        .filter(Boolean);
    });
  }

  updateType(index: number, value: string): void {
    this.patchRow(index, (row) => {
      row.page.page_type = (value === 'dynamic' ? 'dynamic' : 'static') as SeoPageType;
    });
  }

  toggleActive(index: number): void {
    this.patchRow(index, (row) => {
      row.page.is_active = !row.page.is_active;
    });
  }

  updateJsonLd(index: number, value: string): void {
    this.patchRow(index, (row) => {
      row.jsonLdText = value;
    });
  }

  removeRow(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  async confirmImport(): Promise<void> {
    const validPages = this.rows()
      .filter((row) => !row.error)
      .map((row) => row.page);
    if (validPages.length === 0) return;

    this.importing.set(true);
    this.importError.set(null);
    const result = await this.supabaseSeo.bulkUpsert(validPages);
    this.importing.set(false);

    if (result) {
      this.logger.info(`[SeoBulkUpload] Imported ${result.length} SEO pages`);
      this.notification.success(
        'Import complete',
        `${result.length} SEO page${result.length === 1 ? '' : 's'} saved.`,
      );
      this.router.navigate(['/admin', 'seo']);
    } else {
      this.logger.error('[SeoBulkUpload] Bulk import failed');
      this.importError.set('Import failed. Check your connection and try again.');
    }
  }

  /**
   * Mutate one row via `mutate`, re-parse its JSON-LD cell, and recompute its
   * validation error. Re-validation runs live so a fixed cell flips the row
   * (and the summary) immediately. `json_ld` errors take precedence over the
   * field checks in `validateSeoRow`, matching the parser.
   */
  private patchRow(index: number, mutate: (row: SeoRow) => void): void {
    this.rows.update((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const next: SeoRow = { page: { ...row.page }, jsonLdText: row.jsonLdText, error: null };
        mutate(next);
        let error: string | null = null;
        try {
          const trimmed = next.jsonLdText.trim();
          const parsed = trimmed ? JSON.parse(trimmed) : {};
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('not an object');
          }
          next.page.json_ld = parsed as Record<string, unknown>;
        } catch {
          error = 'Invalid JSON-LD';
        }
        next.error = error ?? validateSeoRow(next.page);
        return next;
      }),
    );
  }
}

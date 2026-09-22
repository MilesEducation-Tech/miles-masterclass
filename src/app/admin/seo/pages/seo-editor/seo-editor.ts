import { Component, computed, DestroyRef, inject, OnInit, signal, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { SupabaseSeo } from '@core/services/seo/supabase-seo';
import {
  SeoPage,
  SEO_LIMITS,
  computeSeoScore,
  createDefaultSeoPage,
} from '@core/models/seo.models';
import { Logger } from '@core/services/logger/logger';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroCheckCircle,
  heroExclamationCircle,
  heroDocumentText,
  heroInformationCircle,
  heroCheck,
  heroArrowsRightLeft,
} from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-seo-editor',
  imports: [ReactiveFormsModule, NgIconComponent],
  providers: [
    provideIcons({
      heroArrowLeft,
      heroCheckCircle,
      heroExclamationCircle,
      heroDocumentText,
      heroInformationCircle,
      heroCheck,
      heroArrowsRightLeft,
    }),
  ],
  templateUrl: './seo-editor.html',
})
export class SeoEditor implements OnInit {
  readonly slug = input<string>();

  private readonly supabaseSeo = inject(SupabaseSeo);
  private readonly adminAuth = inject(AdminAuth);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  readonly page = signal<SeoPage | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saveSuccess = signal(false);
  readonly saveError = signal('');
  readonly activeSection = signal<'basic' | 'og' | 'twitter' | 'advanced'>('basic');
  readonly uploadingOgImage = signal(false);
  readonly uploadingTwitterImage = signal(false);
  readonly limits = SEO_LIMITS;

  readonly form: FormGroup = this.fb.group({
    // Basic SEO
    title: ['', [Validators.required]],
    description: [''],
    keywords: [''],
    robots: ['index, follow'],
    canonical_url: [''],
    author: [''],
    publisher: ['Miles Masterclass'],

    // Open Graph
    og_title: [''],
    og_description: [''],
    og_image: [''],
    og_type: ['website'],
    og_site_name: ['Miles Masterclass'],
    og_locale: ['en_US'],

    // Twitter Card
    twitter_card: ['summary_large_image'],
    twitter_site: ['@MilesEducation'],
    twitter_creator: ['@MilesEducation'],
    twitter_title: [''],
    twitter_description: [''],
    twitter_image: [''],
    twitter_image_alt: [''],

    // Advanced
    json_ld: [''],
    notes: [''],
  });

  // Computed preview data from form values
  readonly previewTitle = signal('');
  readonly previewDescription = signal('');
  readonly previewUrl = signal('');

  readonly seoScore = computed(() => {
    const p = this.page();
    if (!p) return 0;
    return computeSeoScore(p);
  });

  readonly scoreClass = computed(() => {
    const s = this.seoScore();
    if (s >= 80) return 'bg-emerald-500/15 text-emerald-400';
    if (s >= 40) return 'bg-amber-500/15 text-amber-400';
    return 'bg-red-500/15 text-red-400';
  });

  ngOnInit(): void {
    this.loadPage();
    // Debounce preview/score recompute so each keystroke isn't a full CD pass
    // (`computeSeoScore` is cheap, but the page signal write fans out into
    // any view binding that reads it).
    this.form.valueChanges
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updatePreviewSignals());
  }

  async loadPage(): Promise<void> {
    const rawSlug = this.slug();
    if (!rawSlug) return;

    const decodedSlug = decodeURIComponent(rawSlug);
    this.loading.set(true);
    this.logger.debug(`[SeoEditor] Loading SEO configuration for slug: ${decodedSlug}`);

    let data = await this.supabaseSeo.getBySlug(decodedSlug);
    if (!data) {
      this.logger.info(`[SeoEditor] Creating default SEO config for slug: ${decodedSlug}`);
      data = createDefaultSeoPage(decodedSlug, decodedSlug, 'static');
    }
    this.page.set(data);
    this.populateForm(data);
    this.loading.set(false);
  }

  private populateForm(page: SeoPage): void {
    this.form.patchValue({
      title: page.title ?? '',
      description: page.description ?? '',
      keywords: (page.keywords ?? []).join(', '),
      robots: page.robots ?? 'index, follow',
      canonical_url: page.canonical_url ?? '',
      author: page.author ?? '',
      publisher: page.publisher ?? 'Miles Masterclass',
      og_title: page.og_title ?? '',
      og_description: page.og_description ?? '',
      og_image: page.og_image ?? '',
      og_type: page.og_type ?? 'website',
      og_site_name: page.og_site_name ?? 'Miles Masterclass',
      og_locale: page.og_locale ?? 'en_US',
      twitter_card: page.twitter_card ?? 'summary_large_image',
      twitter_site: page.twitter_site ?? '@MilesEducation',
      twitter_creator: page.twitter_creator ?? '@MilesEducation',
      twitter_title: page.twitter_title ?? '',
      twitter_description: page.twitter_description ?? '',
      twitter_image: page.twitter_image ?? '',
      twitter_image_alt: page.twitter_image_alt ?? '',
      json_ld:
        page.json_ld && Object.keys(page.json_ld).length > 0
          ? JSON.stringify(page.json_ld, null, 2)
          : '',
      notes: page.notes ?? '',
    });
    this.updatePreviewSignals();
  }

  private updatePreviewSignals(): void {
    const v = this.form.value;
    this.previewTitle.set(v.title || 'Page Title');
    this.previewDescription.set(v.description || 'Page description will appear here...');
    this.previewUrl.set(v.canonical_url || 'https://milesmasterclass.com/...');

    // Update the local page signal for score recalculation
    const current = this.page();
    if (current) {
      this.page.set({
        ...current,
        title: v.title ?? '',
        description: v.description ?? '',
        keywords: this.parseKeywords(v.keywords ?? ''),
        canonical_url: v.canonical_url ?? '',
        og_title: v.og_title ?? '',
        og_description: v.og_description ?? '',
        og_image: v.og_image ?? '',
        twitter_title: v.twitter_title ?? '',
        twitter_description: v.twitter_description ?? '',
      });
    }
  }

  private parseKeywords(value: string): string[] {
    return value
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.saveSuccess.set(false);
    this.saveError.set('');

    const current = this.page();
    if (!current) return;

    const v = this.form.value;

    let parsedJsonLd: Record<string, unknown> = {};
    if (v.json_ld) {
      try {
        parsedJsonLd = JSON.parse(v.json_ld);
      } catch {
        this.saveError.set('Invalid JSON-LD format. Please check your JSON.');
        this.logger.warn(`[SeoEditor] Invalid JSON-LD format for slug: ${current.page_slug}`);
        this.saving.set(false);
        return;
      }
    }

    const updated: SeoPage = {
      ...current,
      title: v.title ?? '',
      description: v.description ?? '',
      keywords: this.parseKeywords(v.keywords ?? ''),
      robots: v.robots ?? 'index, follow',
      canonical_url: v.canonical_url ?? '',
      author: v.author ?? '',
      publisher: v.publisher ?? '',
      og_title: v.og_title ?? '',
      og_description: v.og_description ?? '',
      og_image: v.og_image ?? '',
      og_type: v.og_type ?? 'website',
      og_site_name: v.og_site_name ?? 'Miles Masterclass',
      og_locale: v.og_locale ?? 'en_US',
      twitter_card: v.twitter_card ?? 'summary_large_image',
      twitter_site: v.twitter_site ?? '',
      twitter_creator: v.twitter_creator ?? '',
      twitter_title: v.twitter_title ?? '',
      twitter_description: v.twitter_description ?? '',
      twitter_image: v.twitter_image ?? '',
      twitter_image_alt: v.twitter_image_alt ?? '',
      json_ld: parsedJsonLd,
      notes: v.notes ?? '',
      updated_by: this.currentEditorIdentity(),
    };

    this.logger.info(`[SeoEditor] Saving SEO configuration for slug: ${current.page_slug}`);
    const result = await this.supabaseSeo.upsert(updated);
    this.saving.set(false);

    if (result) {
      this.page.set(result);
      this.saveSuccess.set(true);
      this.logger.info(
        `[SeoEditor] Successfully saved SEO configuration for slug: ${current.page_slug}`,
      );
      setTimeout(() => this.saveSuccess.set(false), 3000);
    } else {
      this.saveError.set('Failed to save. Please try again.');
      this.logger.error(
        `[SeoEditor] Failed to save SEO configuration for slug: ${current.page_slug}`,
      );
    }
  }

  copyToOg(): void {
    const v = this.form.value;
    this.form.patchValue({
      og_title: v.title ?? '',
      og_description: v.description ?? '',
    });
    this.logger.debug(`[SeoEditor] Copied Basic SEO to Open Graph`);
  }

  copyToTwitter(): void {
    const v = this.form.value;
    this.form.patchValue({
      twitter_title: v.title ?? '',
      twitter_description: v.description ?? '',
    });
    this.logger.debug(`[SeoEditor] Copied Basic SEO to Twitter`);
  }

  copyToAll(): void {
    this.copyToOg();
    this.copyToTwitter();
    const ogImage = this.form.value.og_image;
    if (ogImage) {
      this.form.patchValue({ twitter_image: ogImage });
    }
    this.logger.debug(`[SeoEditor] Copied Basic SEO to All`);
  }

  goBack(): void {
    this.router.navigate(['/admin', 'seo']);
  }

  getCharClass(length: number, limits: { min?: number; ideal?: number; max: number }): string {
    if (length === 0) return 'text-slate-500';
    if (limits.min && length < limits.min) return 'text-amber-400';
    if (length > limits.max) return 'text-red-400';
    if (limits.ideal && length > limits.ideal) return 'text-orange-400';
    return 'text-emerald-400';
  }

  setSection(section: 'basic' | 'og' | 'twitter' | 'advanced'): void {
    this.activeSection.set(section);
  }

  onOgImageSelected(event: Event): Promise<void> {
    return this.handleImageUpload(event, 'og_image', this.uploadingOgImage, 'OG');
  }

  onTwitterImageSelected(event: Event): Promise<void> {
    return this.handleImageUpload(event, 'twitter_image', this.uploadingTwitterImage, 'Twitter');
  }

  /**
   * Single source of truth for the file-input → Supabase upload → form-patch
   * dance. Handlers above are thin wrappers so the template still gets two
   * distinct event bindings.
   */
  private async handleImageUpload(
    event: Event,
    field: 'og_image' | 'twitter_image',
    busy: import('@angular/core').WritableSignal<boolean>,
    label: 'OG' | 'Twitter',
  ): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.saveError.set('Please select a valid image file.');
      return;
    }

    busy.set(true);
    this.saveError.set('');

    try {
      this.logger.debug(`[SeoEditor] Uploading ${label} image: ${file.name}`);
      const publicUrl = await this.supabaseSeo.uploadImage(file);

      if (publicUrl) {
        this.form.patchValue({ [field]: publicUrl });
        this.logger.info(`[SeoEditor] Successfully uploaded ${label} image: ${publicUrl}`);
      } else {
        this.saveError.set(`Failed to upload ${label} image. Please try again.`);
        this.logger.error(`[SeoEditor] Failed to upload ${label} image: publicUrl was null`);
      }
    } catch (error) {
      this.saveError.set(`An error occurred during ${label} image upload.`);
      this.logger.error(`[SeoEditor] Error uploading ${label} image:`, error);
    } finally {
      busy.set(false);
      // Reset the file input so the same file could be selected again if needed.
      input.value = '';
    }
  }

  /**
   * Audit identity for `updated_by`. Prefers the admin profile if available,
   * falling back to a placeholder so old data with `'admin'` doesn't keep
   * winning over real edits.
   */
  private currentEditorIdentity(): string {
    const profile = this.adminAuth.adminUser();
    return profile?.email || profile?.full_name || 'admin';
  }
}

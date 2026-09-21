import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { BlogPostView } from '../../models/blog.model';
import { BlogApi } from '../../services/blog-api';
import { toBlogPostView } from '../../utils/blog.util';
import { BlogBanner } from '../../components/blog-banner/blog-banner';
import { BlogCard } from '../../components/blog-card/blog-card';
import { BlogCompactItem } from '../../components/blog-compact-item/blog-compact-item';
import { BlogFeatureCard } from '../../components/blog-feature-card/blog-feature-card';
import { SeoManager } from '../../../../shared/core/services/seo/seo-manager';
import { Faq } from '../../../../pages/faq/faq';

/**
 * Blog landing page (design screen 1): hero + search, a featured mosaic,
 * Editor's Picks with a Spotlight panel, a "View All Blogs" row, and the
 * shared FAQ. Sections are curated from one recent-posts fetch so no WP-side
 * taxonomy is required; swap the `pick(...)` ranges for tag-based queries
 * later if editorial control is needed.
 */
@Component({
  selector: 'app-blog-home',
  imports: [RouterLink, BlogBanner, BlogFeatureCard, BlogCard, BlogCompactItem, Faq],
  templateUrl: './blog-home.html',
  styleUrl: './blog-home.css',
})
export class BlogHome {
  private readonly blogApi = inject(BlogApi);
  private readonly seo = inject(SeoManager);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly posts = signal<BlogPostView[]>([]);
  readonly loading = signal(true);
  readonly errored = signal(false);

  readonly bannerImages = computed(() =>
    this.posts()
      .map((post) => post.featuredImage)
      .filter((url): url is string => !!url)
      .slice(0, 12),
  );

  readonly featured = computed(() => this.posts().slice(0, 5));
  readonly editorLead = computed<BlogPostView | null>(() => this.pick(5, 1)[0] ?? null);
  readonly editorList = computed(() => this.pick(6, 3));
  readonly spotlight = computed(() => this.pick(9, 3));
  readonly viewAll = computed(() => this.pick(12, 4));

  readonly skeletons = Array.from({ length: 5 });

  constructor() {
    this.seo.setSeo({
      title: 'Blog | Miles Masterclass',
      description:
        'The AI-enabled accountant starts here. Insights, strategies, and practical guides to help CPAs and CMAs lead in the age of AI.',
      openGraph: {
        title: 'Miles Masterclass Blog',
        description:
          'Insights, strategies, and practical guides for CPAs and CMAs in the age of AI.',
        type: 'website',
        site_name: 'Miles Masterclass',
      },
      twitter: { card: 'summary_large_image' },
    });

    this.fetchBundle();
  }

  /** Search submit from the hero → browse page with the term applied. */
  onSearch(event: Event, term: string): void {
    event.preventDefault();
    const trimmed = term.trim();
    this.router.navigate(['/blog/all'], { queryParams: trimmed ? { search: trimmed } : {} });
  }

  /** Slice `count` posts starting at `start`, wrapping so sections stay full. */
  private pick(start: number, count: number): BlogPostView[] {
    const list = this.posts();
    if (!list.length) return [];
    return Array.from(
      { length: Math.min(count, list.length) },
      (_, i) => list[(start + i) % list.length],
    );
  }

  private fetchBundle(): void {
    this.loading.set(true);
    this.errored.set(false);
    this.blogApi
      .getPosts({ perPage: 16 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.posts.set(result.posts.map(toBlogPostView));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.errored.set(true);
        },
      });
  }
}

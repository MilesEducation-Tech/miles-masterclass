import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BlogPostView, WpCategory } from '../../models/blog.model';
import { BlogApi } from '../../services/blog-api';
import { toBlogPostView } from '../../utils/blog.util';
import { BlogBanner } from '../../components/blog-banner/blog-banner';
import { BlogListItem } from '../../components/blog-list-item/blog-list-item';
import { SeoManager } from '@core/services/seo/seo-manager';
import { Faq } from '../../../../pages/faq/faq';

/**
 * Browse / search page (design screen 2). Reached from the home search box and
 * the "View all" links. `search` and `category` are bound from query params
 * (withComponentInputBinding); the category id lives in the URL so filter
 * state is shareable and survives reload. Uses "Load more" pagination.
 */
@Component({
  selector: 'app-blog-all',
  imports: [RouterLink, BlogBanner, BlogListItem, Faq],
  templateUrl: './blog-all.html',
  styleUrl: './blog-all.css',
})
export class BlogAll {
  private readonly blogApi = inject(BlogApi);
  private readonly seo = inject(SeoManager);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from query params (`?search=`, `?category=<id>`). */
  readonly search = input<string>('');
  readonly category = input<string>('');

  private readonly perPage = 8;

  readonly categories = signal<WpCategory[]>([]);
  readonly posts = signal<BlogPostView[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly errored = signal(false);

  readonly skeletons = Array.from({ length: 5 });

  readonly searchTerm = computed(() => (this.search() ?? '').trim());
  readonly activeCategoryId = computed(() => {
    const raw = this.category();
    return raw ? Number(raw) : null;
  });
  readonly activeCategoryName = computed(() => {
    const id = this.activeCategoryId();
    return id ? (this.categories().find((c) => c.id === id)?.name ?? '') : '';
  });
  readonly hasMore = computed(() => this.page() < this.totalPages());

  readonly bannerImages = computed(() =>
    this.posts()
      .map((post) => post.featuredImage)
      .filter((url): url is string => !!url)
      .slice(0, 12),
  );

  constructor() {
    this.seo.setSeo({
      title: 'View All Blogs | Miles Masterclass',
      description: 'Browse every article from the Miles Masterclass blog.',
      openGraph: {
        title: 'Miles Masterclass Blog',
        type: 'website',
        site_name: 'Miles Masterclass',
      },
      twitter: { card: 'summary_large_image' },
    });

    this.loadCategories();

    // Re-query from page 1 whenever the search term or category changes.
    effect(() => {
      this.search();
      this.category();
      untracked(() => {
        this.page.set(1);
        this.fetchPosts(false);
      });
    });
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore()) return;
    this.page.update((p) => p + 1);
    this.fetchPosts(true);
  }

  chipClass(active: boolean): string {
    return active
      ? 'rounded-full border border-accent bg-accent/15 px-4 py-1.5 text-sm font-medium text-accent transition-colors'
      : 'rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground';
  }

  private fetchPosts(append: boolean): void {
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
    }
    this.errored.set(false);

    this.blogApi
      .getPosts({
        page: this.page(),
        perPage: this.perPage,
        search: this.searchTerm() || undefined,
        categoryId: this.activeCategoryId(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          const views = result.posts.map(toBlogPostView);
          this.posts.update((prev) => (append ? [...prev, ...views] : views));
          this.total.set(result.total);
          this.totalPages.set(result.totalPages);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadingMore.set(false);
          this.errored.set(true);
        },
      });
  }

  private loadCategories(): void {
    this.blogApi
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => this.categories.set([]),
      });
  }
}

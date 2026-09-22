import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BlogPostView } from '../../models/blog.model';
import { BlogApi } from '../../services/blog-api';
import { SafeHtmlPipe } from '../../pipes/safe-html-pipe';
import { toBlogPostView } from '../../utils/blog.util';
import { BlogCard } from '../../components/blog-card/blog-card';
import { SeoManager } from '@core/services/seo/seo-manager';
import { Faq } from '@shared/components/faq/faq';

/**
 * Single blog post (design screen 3): hero image with an overlapping meta
 * card, the article body, a "More like this" row, and the shared FAQ. The
 * `slug` input is bound from the `:slug` route param; an effect re-fetches
 * whenever it changes so in-app navigation between posts works.
 */
@Component({
  selector: 'app-blog-post',
  imports: [RouterLink, SafeHtmlPipe, BlogCard, Faq],
  templateUrl: './blog-post.html',
  styleUrl: './blog-post.css',
})
export class BlogPost {
  private readonly blogApi = inject(BlogApi);
  private readonly seo = inject(SeoManager);
  private readonly destroyRef = inject(DestroyRef);

  readonly slug = input.required<string>();

  readonly post = signal<BlogPostView | null>(null);
  readonly related = signal<BlogPostView[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly errored = signal(false);

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug) {
        this.fetchPost(slug);
      }
    });
  }

  private fetchPost(slug: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.errored.set(false);
    this.related.set([]);

    this.blogApi
      .getPostBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.loading.set(false);
          if (!post) {
            this.post.set(null);
            this.notFound.set(true);
            this.seo.setSeo({ title: 'Article not found | Miles Masterclass', robots: 'noindex' });
            return;
          }
          const view = toBlogPostView(post);
          this.post.set(view);
          this.applySeo(view);
          this.fetchRelated(view);
        },
        error: () => {
          this.loading.set(false);
          this.errored.set(true);
        },
      });
  }

  private fetchRelated(view: BlogPostView): void {
    const categoryId = view.categories[0]?.id ?? null;
    this.blogApi
      .getPosts({ perPage: 4, categoryId, exclude: [view.id] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          const items = result.posts.map(toBlogPostView);
          if (!items.length && categoryId) {
            this.fetchLatestRelated(view.id);
            return;
          }
          this.related.set(items);
        },
        error: () => this.related.set([]),
      });
  }

  /** Fallback when the post's category has no other articles. */
  private fetchLatestRelated(excludeId: number): void {
    this.blogApi
      .getPosts({ perPage: 4, exclude: [excludeId] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.related.set(result.posts.map(toBlogPostView)),
        error: () => this.related.set([]),
      });
  }

  private applySeo(post: BlogPostView): void {
    const description = post.excerpt;
    const image = post.featuredImage || undefined;
    this.seo.setSeo({
      title: `${post.title} | Miles Masterclass Blog`,
      description,
      image,
      canonicalUrl: `https://www.milesmasterclass.com/blog/${post.slug}`,
      author: post.author,
      openGraph: {
        title: post.title,
        description,
        image,
        type: 'article',
        site_name: 'Miles Masterclass',
      },
      twitter: { card: 'summary_large_image', title: post.title, description, image },
    });
  }
}

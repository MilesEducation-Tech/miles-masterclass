import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogPostView } from '../../models/blog.model';

/**
 * Hero-mosaic card: full-bleed image with the title, author, and meta
 * overlaid on a dark gradient. `size` controls the type scale (the lead
 * card uses `lg`).
 */
@Component({
  selector: 'app-blog-feature-card',
  imports: [RouterLink],
  templateUrl: './blog-feature-card.html',
  styleUrl: './blog-feature-card.css',
})
export class BlogFeatureCard {
  readonly post = input.required<BlogPostView>();
  readonly size = input<'lg' | 'sm'>('sm');
}

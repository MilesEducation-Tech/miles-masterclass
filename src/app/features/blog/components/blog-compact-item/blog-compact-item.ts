import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogPostView } from '../../models/blog.model';

/**
 * Small thumbnail + text row used in the Editor's Picks list and the
 * Spotlight panel. `showExcerpt` adds a two-line teaser (Editor's Picks).
 */
@Component({
  selector: 'app-blog-compact-item',
  imports: [RouterLink],
  templateUrl: './blog-compact-item.html',
  styleUrl: './blog-compact-item.css',
})
export class BlogCompactItem {
  readonly post = input.required<BlogPostView>();
  readonly showExcerpt = input<boolean>(false);
}

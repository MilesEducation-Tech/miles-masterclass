import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogPostView } from '../../models/blog.model';

/** Presentational card for a single blog post in the listing grid. */
@Component({
  selector: 'app-blog-card',
  imports: [RouterLink],
  templateUrl: './blog-card.html',
  styleUrl: './blog-card.css',
})
export class BlogCard {
  readonly post = input.required<BlogPostView>();
}

import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogPostView } from '../../models/blog.model';

/** Horizontal row used in the browse / "View All Blogs" list. */
@Component({
  selector: 'app-blog-list-item',
  imports: [RouterLink],
  templateUrl: './blog-list-item.html',
  styleUrl: './blog-list-item.css',
})
export class BlogListItem {
  readonly post = input.required<BlogPostView>();
}

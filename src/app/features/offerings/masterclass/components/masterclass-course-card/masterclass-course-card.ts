import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { faSolidPlay } from '@ng-icons/font-awesome/solid';
import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { Button } from '@shared/ui/button/button';
import {
  MasterclassCardLayout,
  MasterclassCourse,
} from '@features/offerings/masterclass/models/masterclass-home.model';

/**
 * A course card on the masterclass page, in the shared `app-vertical` /
 * `app-horizontal` designs class-for-class.
 *
 * Its own component rather than those two because they are bound to the legacy
 * `Content` shape and make their own HTTP calls (about, bookmark) — six other
 * pages still depend on both. This one renders `MasterclassCourse` and decides
 * nothing: the trailer goes up as an output, the card itself is a plain link.
 *
 * Not yet here, deliberately: bookmark (no web route in scope), AI Kit (its
 * route is gone), and the info button (it arrives with the about-course PR).
 */
@Component({
  selector: 'app-masterclass-course-card',
  imports: [NgOptimizedImage, RouterLink, NgIcon, Button, CategoriesList, CairaCredlyBadge],
  templateUrl: './masterclass-course-card.html',
})
export class MasterclassCourseCard {
  readonly course = input.required<MasterclassCourse>();
  readonly layout = input<MasterclassCardLayout>('vertical');

  readonly trailer = output<MasterclassCourse>();

  protected readonly icons = { faSolidPlay };

  /**
   * Artwork for this layout, falling back the way the shared cards do. `null`
   * when there is none: an empty string counts as missing, because binding
   * `ngSrc=""` throws NG02952 and kills the render.
   */
  protected readonly thumbnail = computed<string | null>(() => {
    const { horizontal, vertical, square } = this.course().thumbnails;
    return this.layout() === 'vertical'
      ? vertical || horizontal || null
      : horizontal || vertical || square || null;
  });
}

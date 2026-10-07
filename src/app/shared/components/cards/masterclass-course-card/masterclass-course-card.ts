import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { faSolidInfo, faSolidPlay } from '@ng-icons/font-awesome/solid';
import { MasterclassCardLayout, MasterclassCourse } from '@core/models/masterclass-home.model';
import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { Utils } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';

/**
 * A course card from `tracks-page/` (the home page and the masterclass page), in
 * the shared `app-vertical` / `app-horizontal` designs class-for-class.
 *
 * Its own component rather than those two because they are bound to the legacy
 * `Content` shape and make their own HTTP calls (about, bookmark) — six other
 * pages still depend on both. This one renders `MasterclassCourse` and decides
 * nothing: the trailer and the "i" button go up as outputs, the card itself is
 * a plain link.
 *
 * Not yet here, deliberately: bookmark (no web route in scope) and AI Kit (its
 * route is gone).
 */
@Component({
  selector: 'app-masterclass-course-card',
  imports: [NgOptimizedImage, RouterLink, NgIcon, Button, CategoriesList, CairaCredlyBadge],
  templateUrl: './masterclass-course-card.html',
})
export class MasterclassCourseCard {
  private readonly utils = inject(Utils);

  readonly course = input.required<MasterclassCourse>();
  readonly layout = input<MasterclassCardLayout>('vertical');

  /**
   * Image priority (`fetchpriority="high"`, eager): for the few cards that are
   * in the first viewport, where one of them is the LCP element. Off by default.
   */
  readonly priority = input(false);

  /**
   * The "i" button, for a page that opens the course-info dialog on `info`.
   * Off by default: the dialog belongs to the masterclass feature, so the home
   * page's cards have nothing to open.
   */
  readonly showInfo = input(false);

  readonly trailer = output<MasterclassCourse>();
  readonly info = output<MasterclassCourse>();

  protected readonly icons = { faSolidInfo, faSolidPlay };

  /**
   * Absolute, so the card links to the course from any page: a relative
   * `[id, slug]` resolves under whichever route renders the card, which is
   * `/…/home/<id>/<slug>` on the home page.
   */
  protected readonly courseLink = computed(() => [
    '/',
    this.utils.country(),
    this.utils.profession(),
    'masterclass',
    this.course().id,
    this.course().slug,
  ]);

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

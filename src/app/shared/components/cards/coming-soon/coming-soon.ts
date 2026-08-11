import { Component, DestroyRef, inject, input, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon } from '@ng-icons/core';
import { faSolidBell, faSolidPlay } from '@ng-icons/font-awesome/solid';
import { matBookmarkRound } from '@ng-icons/material-icons/round';
import { Button } from '../../ui/button/button';
import { CategoriesList } from '../../categories-list/categories-list';
import { Utils } from '../../../core/services/utils/utils';
import { CourseCard } from '../../../core/models/caira/masterclass.model';

@Component({
  selector: 'app-coming-soon',
  imports: [Button, CategoriesList, NgIcon],
  templateUrl: './coming-soon.html',
  styleUrl: './coming-soon.css',
})
export class ComingSoon {
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);

  card = model.required<CourseCard>();
  index = input.required<number>();
  type = input<'masterclass' | 'podcast' | 'micro-learning'>('masterclass');

  icons = signal({
    faSolidBell,
    faSolidPlay,
    matBookmarkRound,
  });

  openVideoDialog() {
    this.utils.openVideoDialog(this.card().trailer_link, this.card().title);
  }

  /**
   * Bookmark-only — never unbookmark. If the user has already opted in we
   * short-circuit so a stray click can't toggle off, matching the product
   * intent that "Remind Me" is a one-way action on a coming-soon course.
   */
  remindMe() {
    if (this.card().added_bookmark) return;
    const apiType = this.type() === 'micro-learning' ? 'micro_learning' : this.type();
    this.utils
      .toggleBookmarkCourse(this.card().id, { course_type: apiType })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res.status && res.is_bookmarked) {
          this.card.update((c) => ({ ...c, added_bookmark: true }));
        }
      });
  }
}

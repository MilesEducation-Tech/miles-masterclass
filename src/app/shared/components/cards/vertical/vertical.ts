import { NgOptimizedImage } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '../../ui/button/button';
import { faSolidInfo, faSolidPlay, faSolidRobot } from '@ng-icons/font-awesome/solid';
import { matBookmarkBorderRound, matBookmarkRound } from '@ng-icons/material-icons/round';
import { NgIcon } from '@ng-icons/core';
import { Utils } from '../../../core/services/utils/utils';
import { CourseCard } from '../../../core/models/caira/masterclass.model';
import { CategoriesList } from '../../categories-list/categories-list';
import { CairaCredlyBadge } from '../caira-credly-badge/caira-credly-badge';

@Component({
  selector: 'app-vertical',
  imports: [NgOptimizedImage, Button, NgIcon, CategoriesList, CairaCredlyBadge],
  templateUrl: './vertical.html',
  styleUrl: './vertical.css',
})
export class Vertical {
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);

  card = model.required<CourseCard>();
  type = input<'masterclass' | 'podcast' | 'micro-learning' | 'webinar'>('masterclass');
  /** When true, clicking the card emits `cardClicked` instead of routing. */
  disableNavigation = input<boolean>(false);

  /**
   * Card artwork, `null` when the payload has none. Empty strings count as
   * missing — binding `ngSrc=""` throws NG02952 and kills the render.
   */
  protected readonly thumbnail = computed<string | null>(
    () => this.card().thumbnail || this.card().horizontal_thumbnail || null,
  );

  readonly cardClicked = output<any>();

  icons = signal({
    faSolidPlay,
    faSolidInfo,
    faSolidRobot,
    matBookmarkRound,
    matBookmarkBorderRound,
  });

  handleCardClick() {
    if (this.disableNavigation()) {
      this.cardClicked.emit(this.card());
      return;
    }
    this.utils.navigateToCourse(this.type(), this.card().id, this.card().title);
  }

  openCourseInfo() {
    this.utils.openCourseInfo(this.card());
  }

  openVideoDialog() {
    this.utils.openVideoDialog(this.card().trailer_link, this.card().title);
  }

  openAdditionalResources(): void {
    this.utils.openAdditionalResources(this.card().id);
  }

  toggleBookmark(event: Event) {
    event.stopPropagation();
    const apiType = this.type() === 'micro-learning' ? 'micro_learning' : this.type();
    this.utils
      .toggleBookmarkCourse(this.card().id, { course_type: apiType })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res.status) {
          this.card.update((c) => ({ ...c, added_bookmark: res.is_bookmarked }));
        }
      });
  }
}

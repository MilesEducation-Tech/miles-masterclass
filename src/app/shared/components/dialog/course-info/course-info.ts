import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogRef } from '@core/services/dialog/dialog';
import { VideoPoster } from '../../video-poster/video-poster';
import { ContentAbout } from '@core/models/course.model';
import { Button } from '../../ui/button/button';
import { MilesSlug } from '../../miles-slug/miles-slug';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matBookmarkBorderRound,
  matBookmarkRound,
  matPlayArrowRound,
} from '@ng-icons/material-icons/round';
import { phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';
import { CourseAbout } from '../../course-about/course-about';
import { Utils } from '@core/services/utils/utils';

@Component({
  selector: 'app-course-info',
  imports: [VideoPoster, Button, MilesSlug, NgIcon, CourseAbout],
  templateUrl: './course-info.html',
  styleUrl: './course-info.css',
  providers: [
    provideIcons({
      matPlayArrowRound,
      matBookmarkBorderRound,
      matBookmarkRound,
      phosphorShareFatFill,
    }),
  ],
})
export class CourseInfo implements OnInit {
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);

  dialogRef!: DialogRef<CourseInfo>;
  data!: ContentAbout;

  /**
   * Local signal that mirrors `data.added_bookmark`. We can't react to a plain
   * property in the template, and `data` is set by the dialog framework after
   * construction — so the signal seeds itself lazily on first read via a
   * getter. Subsequent toggles update through `bookmarked.set(...)`.
   */
  readonly bookmarked = signal(false);

  ngOnInit() {
    this.bookmarked.set(!!this.data?.added_bookmark);
  }

  close(): void {
    this.dialogRef.close();
  }

  toggleBookmark(): void {
    const course_type =
      this.data.course_type.toLocaleLowerCase() === 'video'
        ? 'masterclass'
        : this.data.course_type.toLocaleLowerCase();
    this.utils
      .toggleBookmarkCourse(this.data.id, { course_type })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res.status) this.bookmarked.set(res.is_bookmarked);
      });
  }

  openShare(): void {
    const url = this.utils.buildCourseUrl(this.data.course_type, this.data.id, this.data.title);
    this.utils.openShareDialog({ url });
  }

  /**
   * Routes to the course detail page for the dialog's underlying course.
   * `course_type` arrives from the API in snake_case (e.g. `micro_learning`);
   * the URL segment is kebab-case, so we normalize before handing off to
   * `Utils.navigateToCourse`. Closes the dialog first so the user isn't left
   * with it stacked over the destination page.
   */
  watchNow(): void {
    const urlSegment =
      this.data.course_type.toLocaleLowerCase() === 'micro_learning'
        ? 'micro-learning'
        : this.data.course_type.toLocaleLowerCase() === 'nano_learning'
          ? 'micro-learning'
          : this.data.course_type.toLocaleLowerCase() === 'video'
            ? 'masterclass'
            : this.data.course_type.toLocaleLowerCase();
    this.dialogRef.close();
    this.utils.navigateToCourse(urlSegment, this.data.id, this.data.title);
  }
}

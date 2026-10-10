import { Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBot, lucideDownload, lucideFileText, lucideVideo } from '@ng-icons/lucide';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * The course page's Resource section, from `miscellaneous_data`, in the shared
 * `CourseResources` design class for class. That one stays on the legacy facade
 * for podcast.
 *
 * The glossary and the course-navigation video open dialogs through
 * `CourseDetailFacade`. Exercise files and the AI Kit arrive as URLs and are
 * plain links.
 */
@Component({
  selector: 'app-masterclass-course-resources',
  imports: [NgIcon],
  templateUrl: './masterclass-course-resources.html',
  providers: [provideIcons({ lucideVideo, lucideFileText, lucideDownload, lucideBot })],
})
export class MasterclassCourseResources {
  protected readonly facade = inject(CourseDetailFacade);

  protected readonly resources = computed(() => this.facade.course()?.miscellaneous_data ?? null);
}

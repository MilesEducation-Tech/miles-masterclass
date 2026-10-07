import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBot, lucideDownload, lucideFileText, lucideVideo } from '@ng-icons/lucide';
import { MasterclassResources } from '@features/offerings/masterclass/models/masterclass-course.model';

/**
 * The course page's Resource section, from `miscellaneous_data`, in the shared
 * `CourseResources` design class for class. That one stays on the legacy facade
 * for podcast.
 *
 * The glossary and the course-navigation video open dialogs, so they go up as
 * outputs. Exercise files and the AI Kit arrive as URLs and are plain links.
 */
@Component({
  selector: 'app-masterclass-course-resources',
  imports: [NgIcon],
  templateUrl: './masterclass-course-resources.html',
  providers: [provideIcons({ lucideVideo, lucideFileText, lucideDownload, lucideBot })],
})
export class MasterclassCourseResources {
  readonly resources = input.required<MasterclassResources>();

  readonly navigation = output();
  readonly glossary = output();
}

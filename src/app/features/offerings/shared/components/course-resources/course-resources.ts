import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideVideo, lucideFileText, lucideDownload, lucideBot } from '@ng-icons/lucide';
import {
  VideoDialog,
  VideoDialogData,
} from '../../../../../shared/components/dialog/video-dialog/video-dialog';
import { Dialog } from '../../../../../shared/core/services/dialog/dialog';
import {
  HtmlContentDialog,
  HtmlContentDialogData,
} from '../../../../../shared/components/dialog/html-content-dialog/html-content-dialog';
import { CourseDetail } from '../../services/course-detail/course-detail';

@Component({
  selector: 'app-course-resources',
  standalone: true,
  imports: [CommonModule, NgIcon],
  templateUrl: './course-resources.html',
  styleUrl: './course-resources.css',
  providers: [provideIcons({ lucideVideo, lucideFileText, lucideDownload, lucideBot })],
})
export class CourseResources {
  readonly courseType = input<string>('masterclass');

  /** Route-scoped — the same instance the course page keys on the route id. */
  protected readonly masterclassFacade = inject(CourseDetail);
  private readonly dialog = inject(Dialog);

  readonly resources = computed(() => {
    const details = this.masterclassFacade.courseDetails();
    if (!details) return [];

    const items = [];

    if (details.navigation_link) {
      items.push({
        label: 'Course Navigation',
        type: 'link',
        icon: 'lucideVideo',
        url: details.navigation_link,
        action: 'navigate',
        isDownload: false,
      });
    }

    // Guarded again now that there's a real source: #4 resolves
    // `glossary_file_url` to `null` for courses that have no glossary, and an
    // always-rendered button that opens nothing is worse than no button.
    if (details.glossary_doc) {
      items.push({
        label: 'Glossary',
        type: 'action',
        icon: 'lucideFileText',
        url: details.glossary_doc,
        action: 'glossary',
        isDownload: false,
      });
    }

    if (details.has_exercise_files) {
      items.push({
        label: 'Exercise Files',
        type: 'action',
        icon: 'lucideFileText',
        url: '',
        action: 'exercise',
        isDownload: true,
      });
    }

    if (details.has_additional_resource) {
      items.push({
        label: 'AI Kit',
        type: 'action',
        icon: 'lucideBot',
        url: '',
        action: 'ai-kit',
        isDownload: false,
      });
    }

    return items;
  });

  handleResourceClick(resource: any) {
    if (resource.action === 'navigate') {
      this.openVideoDialog();
    } else if (resource.action === 'glossary') {
      this.openGlossary();
    } else if (resource.action === 'exercise') {
      this.masterclassFacade.downloadExerciseFiles();
    } else if (resource.action === 'ai-kit') {
      this.masterclassFacade.openAdditionalResources();
    } else if (resource.url) {
      window.open(resource.url, '_blank');
    }
  }

  /**
   * `glossary_file_url` is polymorphic by design: #4 resolves it as
   * `Glossary_Text` → `Glossary_File.url` → `Glossary_PDF.url` → `null`, so the
   * same key carries either the glossary's HTML or a link to it. A URL opens in
   * a new tab; anything else is rendered in the dialog. There is no second
   * request — the course payload already carries it.
   */
  openGlossary() {
    const glossary = this.masterclassFacade.courseDetails()?.glossary_doc;
    if (!glossary) return;

    if (/^https?:\/\//i.test(glossary.trim())) {
      window.open(glossary, '_blank', 'noopener,noreferrer');
      return;
    }
    this.openGlossaryDialog(glossary);
  }

  private openGlossaryDialog(html: string) {
    const courseTitle = this.masterclassFacade.courseDetails()?.title ?? '';
    this.dialog.open<HtmlContentDialog, HtmlContentDialogData>(HtmlContentDialog, {
      maxWidth: '100%',
      data: {
        title: courseTitle ? `${courseTitle} - Glossary` : 'Glossary',
        htmlContent: html,
      },
    });
  }

  openVideoDialog() {
    const courseDetails = this.masterclassFacade.courseDetails();
    if (!courseDetails) return;
    if (!courseDetails.navigation_link) return;

    let videoType = 'video/mp4';
    if (
      courseDetails.navigation_link.includes('youtube.com') ||
      courseDetails.navigation_link.includes('youtu.be')
    ) {
      videoType = 'video/youtube';
    } else if (courseDetails.navigation_link.endsWith('.m3u8')) {
      videoType = 'application/x-mpegURL';
    }

    this.dialog.open<VideoDialog, VideoDialogData>(VideoDialog, {
      maxWidth: '100%',
      panelClass: 'video-dialog-panel',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      data: {
        videoSource: {
          src: courseDetails.navigation_link,
          type: videoType,
        },
        title: courseDetails.title,
        videoConfig: {
          autoplay: true,
          controls: true,
          responsive: true,
          fluid: true,
          fullScreenOnReady: true,
        },
      },
    });
  }
}

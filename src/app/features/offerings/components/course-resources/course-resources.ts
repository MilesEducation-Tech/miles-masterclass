import { Component, computed, DestroyRef, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideVideo, lucideFileText, lucideDownload, lucideBot } from '@ng-icons/lucide';
import { MasterclassFacade } from '../../services/masterclass-facade';
import { VideoDialog, VideoDialogData } from '@shared/dialogs/video-dialog/video-dialog';
import { Dialog } from '@core/services/dialog/dialog';
import {
  HtmlContentDialog,
  HtmlContentDialogData,
} from '@features/offerings/dialogs/html-content-dialog/html-content-dialog';

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

  protected readonly masterclassFacade = inject(MasterclassFacade);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private glossaryCache: string | null = null;

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

    // if (details.glossary_doc) {
    items.push({
      label: 'Glossary',
      type: 'action',
      icon: 'lucideFileText',
      url: details.glossary_doc,
      action: 'glossary',
      isDownload: false,
    });
    // }

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
      this.masterclassFacade.downloadExerciseFiles(this.courseType());
    } else if (resource.action === 'ai-kit') {
      this.masterclassFacade.openAdditionalResources();
    } else if (resource.url) {
      window.open(resource.url, '_blank');
    }
  }

  openGlossary() {
    if (this.glossaryCache) {
      this.openGlossaryDialog(this.glossaryCache);
      return;
    }

    const details = this.masterclassFacade.courseDetails();
    if (!details) return;

    this.masterclassFacade
      .fetchCourseContent({ id: details.id, course_type: this.courseType() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response?.data?.glossary_transcript_text) {
          this.glossaryCache = response.data.glossary_transcript_text;
          this.openGlossaryDialog(this.glossaryCache);
        }
      });
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

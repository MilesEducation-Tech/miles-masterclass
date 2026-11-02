import { inject, Service } from '@angular/core';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { map } from 'rxjs';
import { COURSE_RESOURCES_COPY, COURSE_RESOURCES_ROUTE } from '@core/constants/course-resources';
import { CourseResources, parseCourseResources } from '@core/models/course-resources.model';
import { MasterclassCourse } from '@core/models/masterclass-home.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import type { UtilsDialogData } from '@shared/dialogs/utils-dialog/utils-dialog';

/**
 * The course card's AI Kit button, for every page that turns it on
 * (`showAiKit`): the course library and the masterclass page. Reads the
 * course's extras and lists them in the "Additional Resources" dialog, the kit
 * first, then the exercise files. Root and lazy: created on the first page
 * that injects it.
 */
@Service()
export class CourseAiKit {
  private readonly api = inject(ApiClient);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);

  open(course: MasterclassCourse): void {
    const route = COURSE_RESOURCES_ROUTE;
    this.api
      .call({ ...route, path: route.path.replace(':id', course.id) }, undefined, {
        params: { login_type: 'pre_login' },
      })
      .pipe(map(parseCourseResources))
      .subscribe({
        next: (resources) => void this.showResources(resources),
        error: (error: unknown) => {
          this.logger.error('Failed to fetch additional resources', error);
          this.notification.error(
            COURSE_RESOURCES_COPY.errorTitle,
            COURSE_RESOURCES_COPY.errorMessage,
          );
        },
      });
  }

  private async showResources({ aiKit, exerciseFiles }: CourseResources): Promise<void> {
    const links = [
      ...(aiKit
        ? [
            {
              label: aiKit.name,
              href: aiKit.url,
              description: aiKit.description ?? COURSE_RESOURCES_COPY.aiKit,
            },
          ]
        : []),
      ...exerciseFiles.map(({ name, url }) => ({
        label: name,
        href: url,
        description: COURSE_RESOURCES_COPY.exerciseFile,
      })),
    ];
    if (!links.length) {
      this.notification.info(COURSE_RESOURCES_COPY.emptyTitle, COURSE_RESOURCES_COPY.emptyMessage);
      return;
    }
    // Loaded on open: only an AI Kit click needs it.
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    this.dialogs.open<UtilsDialogData>(UtilsDialog, {
      data: {
        title: COURSE_RESOURCES_COPY.title,
        containerClass: 'max-w-lg text-start!',
        content: [{ type: 'links', items: links }],
        buttons: [{ label: 'Close', variant: 'default', action: 'close' }],
      },
    });
  }
}

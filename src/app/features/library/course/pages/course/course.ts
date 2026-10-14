import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  untracked,
  viewChild,
} from '@angular/core';

import { COURSE_TYPE_TABS } from '@core/models/library-filters.model';
import { CourseFacade } from '../../services/course-facade';
import { Tabs } from '@shared/ui/tabs/tabs';
import { Tab } from '@shared/ui/tabs/tab';

@Component({
  selector: 'app-course',
  imports: [Tabs, Tab],
  templateUrl: './course.html',
  host: {
    class: 'p-4',
  },
})
export class Course {
  readonly facade = inject(CourseFacade);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly tabs = COURSE_TYPE_TABS;
  readonly tabLabels = computed(() => this.tabs.map((t) => t.label));
  readonly currentLabel = computed(
    () => this.tabs.find((t) => t.apiType === this.facade.courseType())?.label ?? '',
  );

  readonly listSection = viewChild<ElementRef<HTMLDivElement>>('listSection');

  constructor() {
    // Scroll the controls + grid into view on a type change. Skip first run.
    let firstRun = true;
    effect(() => {
      this.facade.courseType();
      untracked(() => {
        if (firstRun) {
          firstRun = false;
          return;
        }
        if (!this.isBrowser) return;
        this.listSection()?.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    });
  }

  onTabChange(label: string) {
    const tab = this.tabs.find((t) => t.label === label);
    if (tab) this.facade.selectCourseType(tab.apiType);
  }
}

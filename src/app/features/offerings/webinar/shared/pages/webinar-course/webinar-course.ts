import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { CourseAbout } from '../../../../../../shared/components/course-about/course-about';
import { Auth } from '../../../../../../shared/core/services/auth/auth';
import { AppDownloadPrompt } from '../../../../../../shared/core/services/app-download-prompt/app-download-prompt';
import { WebinarHero } from '../../components/webinar-hero/webinar-hero';
import { upcomingToContentAbout } from '../../utils/upcoming-to-content';

@Component({
  selector: 'app-webinar-course',
  imports: [RouterLink, WebinarHero, CourseAbout],
  templateUrl: './webinar-course.html',
  styleUrl: './webinar-course.css',
  providers: [
    // Webinar UI standardises on Eastern Time across hero / list / cards / dialog
    // — match that here so any `DatePipe` nested under this page (e.g. inside
    // `CourseAbout`) renders the same timezone as the rest of the surface.
  ],
})
export class WebinarCourse {
  // ponytail: WebinarFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly facade: any = {
    findById: (..._args: any[]): any => null,
    loadHomePage: signal<any>(null),
  };
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);

  /** Exposed for the template — same auth-derived guard the hero uses. */
  protected readonly isAuthed = computed(() => this.auth.isLoggedIn());

  /**
   * Bound from the `:courseId` route segment via `withComponentInputBinding()`
   * ([app.config.ts](app/app.config.ts)). Must stay named `courseId` to match
   * the route param exactly — renaming either side silently breaks the binding.
   */
  readonly courseId = input<string>();

  private readonly idFromRoute = computed<number | null>(() => {
    const raw = this.courseId();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  });

  /** Local fallback when the home cache doesn't have the webinar. */
  private readonly fetched = signal<any | null>(null);
  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);

  /** Prefer the home cache (instant, already loaded) then fall back to fetch. */
  protected readonly webinar = computed<any | null>(() => {
    const id = this.idFromRoute();
    if (id == null) return null;
    return this.facade.findById(id) ?? this.fetched();
  });

  /**
   * `ContentAbout` shape consumed by `<app-course-about>`. The adapter pads
   * masterclass-specific fields (chapters, exam rules, etc.) with sensible
   * defaults so the shared layout still renders cleanly for webinars.
   */
  protected readonly contentAbout = computed<any | null>(() => {
    const w = this.webinar();
    return w ? upcomingToContentAbout(w) : null;
  });

  constructor() {
    inject(AppDownloadPrompt).maybePrompt();

    // Trigger home-page load (covers direct navigation when the home cache is empty).
    // if (!this.courseId()) this.facade.loadHomePage();

    effect(() => {
      const id = this.idFromRoute();
      const cached = this.webinar();
      if (id != null && !cached && !this.loading()) {
        untracked(() => this.fetchById(id));
      }
    });
  }

  /** Fetch the record. The facade owns the endpoints and the v2 adaptation. */
  private fetchById(id: number): void {
    this.loading.set(true);
    this.facade
      .loadDetails(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((webinar: any) => {
        this.fetched.set(webinar);
        this.notFound.set(!webinar);
        this.loading.set(false);
      });
  }
}

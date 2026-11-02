import { HttpContext } from '@angular/common/http';
import { inject, linkedSignal, Service } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable, Subject } from 'rxjs';
import {
  MASTERCLASS_BOOKMARK_ROUTE,
  MASTERCLASS_BOOKMARK_TOASTS,
} from '@core/constants/masterclass';
import { SKIP_LOADING } from '@core/models/http.model';
import {
  MasterclassBookmarkable,
  MasterclassCourse,
  parseBookmarkToggle,
} from '@core/models/masterclass-home.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';

/**
 * The learner's masterclass bookmarks for this visit, shared by every card that
 * shows one (the home page's tracks, the masterclass page's rails) and by the
 * course page.
 *
 * Root because three features read it. A card's `is_bookmarked` is only as
 * fresh as the read that brought it, and `tracks-page/` is held for the whole
 * visit by the root `MasterclassHomeFacade`, so a toggle's answer is kept here
 * and wins over the card's.
 */
@Service()
export class MasterclassBookmarks {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);

  /**
   * This visit's answers, by course id. Reset when the session signs in or out,
   * so a sign-out never shows the previous learner's bookmarks.
   */
  private readonly answers = linkedSignal<boolean, ReadonlyMap<string, boolean>>({
    source: () => this.auth.isAuthenticated(),
    computation: () => new Map(),
  });

  /** Courses whose toggle is in flight; another click on one is ignored. Nothing renders it. */
  private readonly pending = new Set<string>();

  private readonly changes = new Subject<string>();

  /** A course id after each confirmed change. My List re-reads on it. */
  readonly changed$: Observable<string> = this.changes.asObservable();

  isBookmarked(course: MasterclassBookmarkable): boolean {
    return this.answers().get(course.id) ?? course.is_bookmarked ?? false;
  }

  /**
   * Signed out, to sign-in and back, as the course page does. Signed in, the
   * card flips at once and then keeps the server's answer; a failure flips it
   * back and says so.
   */
  toggle(course: MasterclassCourse): void {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/auth/login'], { queryParams: { redirect: this.router.url } });
      return;
    }
    const { id, title } = course;
    if (this.pending.has(id)) return;

    const before = this.answers().get(id);
    this.setAnswer(id, !this.isBookmarked(course));
    this.pending.add(id);
    this.api
      .call(
        { ...MASTERCLASS_BOOKMARK_ROUTE, path: MASTERCLASS_BOOKMARK_ROUTE.path.replace(':id', id) },
        undefined,
        // The icon flipping is the indicator, so no page-wide loading bar.
        { context: new HttpContext().set(SKIP_LOADING, true) },
      )
      .pipe(map(parseBookmarkToggle))
      .subscribe({
        next: (bookmarked) => {
          this.pending.delete(id);
          this.record(id, bookmarked, title);
        },
        error: (error: unknown) => {
          this.pending.delete(id);
          this.setAnswer(id, before);
          this.logger.error('[MasterclassBookmarks] toggle failed', error);
          const { failed } = MASTERCLASS_BOOKMARK_TOASTS;
          this.notification.error(failed.title, failed.message);
        },
      });
  }

  /**
   * A confirmed answer, from a card or from the course page's own toggle: every
   * card follows it, My List re-reads, and a toast says where it landed.
   */
  record(id: string, bookmarked: boolean, title: string): void {
    this.setAnswer(id, bookmarked);
    this.changes.next(id);
    const { added, removed } = MASTERCLASS_BOOKMARK_TOASTS;
    this.notification.success(bookmarked ? added : removed, title);
  }

  /** `undefined` forgets the answer, so the card's own flag shows again. */
  private setAnswer(id: string, bookmarked: boolean | undefined): void {
    this.answers.update((answers) => {
      const next = new Map(answers);
      if (bookmarked === undefined) next.delete(id);
      else next.set(id, bookmarked);
      return next;
    });
  }
}

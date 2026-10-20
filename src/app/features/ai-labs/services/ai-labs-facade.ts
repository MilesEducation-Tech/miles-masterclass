import { HttpContext, HttpErrorResponse, httpResource } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, effect, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, Subscription, takeWhile, tap, timer } from 'rxjs';
import { MASTERCLASS_COURSE_TYPE } from '@core/constants/masterclass';
import { CommonResponse, SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import { MasterclassCourse, parseCoursePage } from '@core/models/masterclass-home.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { Storage } from '@core/services/storage/storage';
import { AI_LABS_API } from '@features/ai-labs/constants/ai-labs-api';
import {
  AiLabAccountState,
  AiLabAgentCard,
  AiLabCatalogueSection,
  AiLabCourseListItem,
  AiLabPracticalProgress,
  AiLabWebPage,
} from '@features/ai-labs/models/ai-labs.model';
import { Utils } from '@shared/services/utils';

/** The guide's ceiling; the catalogue is a handful of rows, so one page holds it. */
const PAGE_SIZE = 100;

/** The guide asks for 10–15 s between account reads while provisioning runs. */
const POLL_INTERVAL_MS = 12_000;

/** Provisioning takes two to three minutes; past this the hero says so and offers Refresh. */
const POLL_TIMEOUT_MS = 5 * 60_000;

/**
 * Remembers that a provisioning request already went out, so a reload during the wait resumes the
 * poll instead of inviting a second create. Session-scoped on purpose: `account-ensure/` has no
 * "pending" state to read back, so this is the only thing that bridges a reload until
 * `account_created` flips.
 */
const ACCOUNT_REQUESTED_KEY = 'ai_lab.account_requested';

/** Heading for the guest catalogue, which is one rail of courses rather than labs per course. */
const GUEST_HEADING = 'Masterclasses with AI Labs';

/** Heading for labs whose parent course isn't on the rail. Rare, but never dropped. */
const UNGROUPED_HEADING = 'More AI Labs';

/**
 * The AI Labs landing page's data: the catalogue and the learner's lab account.
 *
 * Route-scoped (`autoProvided: false`, listed on the landing route): the hero, the catalogue and
 * the terms dialog all read the account state, and the provisioning poll must stop when the
 * learner leaves the page.
 *
 * **Catalogue.** A guest gets the public rail — masterclass courses that have a lab, one card each,
 * server-rendered so the page stays indexable. A signed-in learner gets the labs themselves
 * (`ai-labs/courses/` is `IsAuthenticated`), grouped under their parent course, whose title the
 * rail supplies. If the lab list is empty or fails, the learner sees the rail instead of nothing.
 *
 * **Account.** `account-ensure/` is read once per sign-in, browser only, and re-read every 12 s
 * after a create until `account_created` flips or five minutes pass.
 */
@Service({ autoProvided: false })
export class AiLabsFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthSession);
  private readonly logger = inject(Logger);
  private readonly storage = inject(Storage);
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly isAuthenticated = this.auth.isAuthenticated;

  // ---- Catalogue -----------------------------------------------------------

  /** A catalogue hiccup shouldn't toast someone who is just reading the page. */
  private readonly rail = httpResource<MasterclassCourse[]>(
    () => ({
      url: apiUrl(AI_LABS_API.rail),
      params: {
        course_type: MASTERCLASS_COURSE_TYPE,
        login_type: 'pre_login',
        page_size: PAGE_SIZE,
      },
      context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
    }),
    { defaultValue: [], parse: parseCoursePage('ai-labs') },
  );

  /** Gated on the boolean, never the token — a rotation must not refetch the catalogue. */
  private readonly labs = httpResource<AiLabCourseListItem[]>(
    () =>
      this.auth.isAuthenticated()
        ? {
            url: apiUrl(AI_LABS_API.courses),
            params: { page_size: PAGE_SIZE },
            context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
          }
        : undefined,
    {
      defaultValue: [],
      parse: (raw) =>
        (raw as CommonResponse<AiLabWebPage<AiLabCourseListItem>> | null)?.data?.results ?? [],
    },
  );

  private readonly railCourses = computed(() => (this.rail.hasValue() ? this.rail.value() : []));
  private readonly labRows = computed(() => (this.labs.hasValue() ? this.labs.value() : []));

  readonly sections = computed<AiLabCatalogueSection[]>(() => {
    const courses = this.railCourses();
    const labs = this.labRows();
    if (this.auth.isAuthenticated() && labs.length) return this.groupLabs(labs, courses);
    return courses.length ? [{ heading: GUEST_HEADING, cards: courses.map(railCard) }] : [];
  });

  readonly catalogueLoading = computed(
    () => this.rail.isLoading() || (this.auth.isAuthenticated() && this.labs.isLoading()),
  );

  // ---- Account -------------------------------------------------------------

  /** Background state, so no loading bar; a failure renders the neutral hero, not a toast. */
  private readonly account = httpResource<AiLabAccountState | null>(
    () =>
      this.isBrowser && this.auth.isAuthenticated()
        ? {
            url: apiUrl(AI_LABS_API.accountEnsure),
            context: new HttpContext().set(SKIP_LOADING, true).set(SKIP_ERROR_NOTIFICATION, true),
          }
        : undefined,
    {
      defaultValue: null,
      parse: (raw) => (raw as CommonResponse<AiLabAccountState> | null)?.data ?? null,
    },
  );

  readonly accountState = computed(() => (this.account.hasValue() ? this.account.value() : null));
  readonly accountLoading = computed(() => this.account.isLoading());
  readonly hasLabAccount = computed(() => !!this.accountState()?.account_created);

  /**
   * The learner's practical record across every lab, for the progress panel. Calls AI Labs, so it
   * waits for the account to exist; `is_provisioned: false` or a failure means no panel.
   */
  private readonly practicalProgressRes = httpResource<AiLabPracticalProgress | null>(
    () =>
      this.isBrowser && this.auth.isAuthenticated() && this.hasLabAccount()
        ? {
            url: apiUrl(AI_LABS_API.practicalProgress),
            context: new HttpContext().set(SKIP_LOADING, true).set(SKIP_ERROR_NOTIFICATION, true),
          }
        : undefined,
    {
      defaultValue: null,
      parse: (raw) => {
        const data = (
          raw as CommonResponse<{
            is_provisioned: boolean;
            progress: AiLabPracticalProgress;
          }> | null
        )?.data;
        return data?.is_provisioned ? data.progress : null;
      },
    },
  );

  readonly practicalProgress = computed(() =>
    this.practicalProgressRes.hasValue() ? this.practicalProgressRes.value() : null,
  );
  readonly practicalProgressLoading = computed(() => this.practicalProgressRes.isLoading());

  /** A create or a reset is in flight. */
  readonly submitting = signal(false);

  /** A provisioning request went out and the account hasn't appeared yet. */
  private readonly requested = signal(
    this.storage.getSession<string>(ACCOUNT_REQUESTED_KEY) === 'true',
  );
  readonly polling = signal(false);
  readonly pollTimedOut = signal(false);
  private pollSub: Subscription | null = null;

  /** The account is on its way — the hero swaps its secondary slot and copy for the wait. */
  readonly accountRequested = computed(
    () => !this.hasLabAccount() && (this.polling() || this.requested()),
  );

  constructor() {
    // Resume a wait a reload interrupted, and drop the flag once the account exists.
    effect(() => {
      if (this.hasLabAccount()) {
        this.setRequested(false);
        this.stopPolling();
      } else if (
        this.requested() &&
        this.account.hasValue() &&
        this.accountState() &&
        !this.pollSub
      ) {
        this.poll();
      }
    });

    // The hero degrades to its neutral state on failure, so the log is where a drift shows.
    effect(() => {
      const error = this.rail.error() ?? this.labs.error();
      if (error) this.logger.error('[AiLabsFacade] catalogue load failed', error);
    });

    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  /** The hero's manual fallback to the poll. */
  refresh(): void {
    this.pollTimedOut.set(false);
    this.account.reload();
  }

  /**
   * `POST account-create/`. Answers with the account state either way — the 422 / 503 error bodies
   * carry the same `{eligible, reason, account_created}` — or `null` when the failure had none.
   * A 202 starts the poll here; every other branch is the caller's to say.
   */
  createAccount(): Observable<AiLabAccountState | null> {
    return this.accountCall(AI_LABS_API.accountCreate).pipe(
      tap((state) => {
        if (
          state?.reason === 'PROVISIONING_STARTED' ||
          state?.reason === 'PROVISIONING_IN_PROGRESS'
        ) {
          this.setRequested(true);
          this.poll();
        } else if (state?.reason === 'ACCOUNT_EXISTS') {
          this.account.reload();
        }
      }),
    );
  }

  /** `POST account-reset-password/`. Same answer shape as `createAccount`. */
  resetPassword(): Observable<AiLabAccountState | null> {
    return this.accountCall(AI_LABS_API.accountResetPassword);
  }

  /**
   * Sign out, then sign in and come back here. For `ACCOUNT_EXISTS` with
   * `entitlement_refresh_required`: AI Labs reads the entitlement off the login token, and only a
   * freshly issued one carries it — a refresh is not documented to, so this is the guide's re-login.
   */
  async signInAgain(): Promise<void> {
    const redirect = this.router.url;
    await this.auth.logout();
    await this.router.navigate(['/auth/login'], { queryParams: { redirect } });
  }

  // ---- Internals -------------------------------------------------------------

  private accountCall(
    route: typeof AI_LABS_API.accountCreate | typeof AI_LABS_API.accountResetPassword,
  ): Observable<AiLabAccountState | null> {
    this.submitting.set(true);
    return this.api
      .call(route, undefined, { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) })
      .pipe(
        map((res) => res.data ?? null),
        catchError((err: unknown) => of(accountStateOf(err))),
        tap(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      );
  }

  /** Re-read `account-ensure/` every 12 s until the account exists or five minutes pass. */
  private poll(): void {
    this.stopPolling();
    this.polling.set(true);
    this.pollTimedOut.set(false);
    this.pollSub = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(
        takeWhile(
          (tick) => (tick + 1) * POLL_INTERVAL_MS <= POLL_TIMEOUT_MS && !this.hasLabAccount(),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.account.reload(),
        complete: () => {
          this.polling.set(false);
          this.pollSub = null;
          if (!this.hasLabAccount()) this.pollTimedOut.set(true);
        },
      });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
    this.polling.set(false);
  }

  private setRequested(on: boolean): void {
    this.requested.set(on);
    if (on) this.storage.setSession(ACCOUNT_REQUESTED_KEY, 'true');
    else this.storage.removeSession(ACCOUNT_REQUESTED_KEY);
  }

  /**
   * Labs under their parent course, in rail order, each rail sorted by `ai_lab_course_order`. A lab
   * whose course isn't on the rail goes under `UNGROUPED_HEADING` rather than vanishing.
   */
  private groupLabs(
    labs: readonly AiLabCourseListItem[],
    courses: readonly MasterclassCourse[],
  ): AiLabCatalogueSection[] {
    const byCourse = new Map<string, AiLabCourseListItem[]>();
    for (const lab of labs) {
      const key = lab.lock_state?.masterclass_course_id ?? '';
      byCourse.set(key, [...(byCourse.get(key) ?? []), lab]);
    }

    const toCards = (rows: AiLabCourseListItem[]): AiLabAgentCard[] =>
      [...rows]
        .sort((a, b) => a.ai_lab_course_order - b.ai_lab_course_order)
        .map((row) => labCard(row, this.utils.slugify(row.ai_lab_course_name)));

    const sections: AiLabCatalogueSection[] = [];
    for (const course of courses) {
      const rows = byCourse.get(course.id);
      if (!rows) continue;
      sections.push({ heading: course.title, cards: toCards(rows) });
      byCourse.delete(course.id);
    }
    const rest = [...byCourse.values()].flat();
    if (rest.length) sections.push({ heading: UNGROUPED_HEADING, cards: toCards(rest) });
    return sections;
  }
}

/** A guest card: the course, opening its masterclass page. */
function railCard(course: MasterclassCourse): AiLabAgentCard {
  const t = course.thumbnails;
  return {
    name: course.title,
    description: course.short_description ?? '',
    portraitThumbnail: t.vertical,
    thumbnail: t.horizontal ?? t.square,
    thumbnailAlt: course.title,
    route: ['masterclass', course.id, course.slug],
  };
}

/** A learner card: the lab, opening its own page. */
function labCard(lab: AiLabCourseListItem, slug: string): AiLabAgentCard {
  return {
    name: lab.ai_lab_course_name,
    description: lab.ai_lab_course_mini_description ?? '',
    portraitThumbnail:
      lab.ai_lab_course_vertical_thumbnail_url ?? lab.ai_lab_course_square_thumbnail_url,
    thumbnail: lab.ai_lab_course_horizontal_thumbnail_url ?? lab.ai_lab_course_square_thumbnail_url,
    thumbnailAlt: lab.ai_lab_course_name,
    duration: lab.ai_lab_course_total_duration,
    route: ['ai-labs', lab.id, slug],
  };
}

/** The `{eligible, reason, account_created}` body an account route's error carries, if any. */
function accountStateOf(err: unknown): AiLabAccountState | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  const data = (err.error as CommonResponse<unknown> | null)?.data;
  return data && typeof data === 'object' && 'reason' in data ? (data as AiLabAccountState) : null;
}

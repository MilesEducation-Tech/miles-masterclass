import { environment } from '@env/environment';
import { CourseDetailApi, CourseOffering } from '@features/offerings/models/course-detail.model';

/**
 * Absolute URLs off `BASE_API_URL`, which is the ORIGIN ROOT (trailing slash,
 * no `api/` segment). Built whole, the same way as `WEBINAR_ENDPOINTS`, so
 * `apiUrl()` passes them through untouched and the `web-api/` surface is
 * spelled out where a reviewer can see it. These pages never call `app-api/`.
 */
const ROOT = environment.BASE_API_URL;

/**
 * `CourseDetailFacade`'s routes and names, per offering. An offering joins by
 * adding its entry, once the backend ships its web routes; none is guessed.
 */
export const COURSE_DETAIL_API: Record<CourseOffering, CourseDetailApi> = {
  masterclass: {
    /**
     * Web-only read, `AllowAny` since 2026-10-07: the course page, both sides of
     * login. Append `<uuid>/` (a slug is a 404). `?login_type=` is required:
     * `pre_login` is served anonymously, `post_login` is a 401 without a token,
     * and an undeclared parameter is a 400.
     */
    courseDetail: `${ROOT}web-api/v1/masterclass/course-detail/`,

    /**
     * Web-only read, `AllowAny`: one course's public content. Takes exactly one
     * of `?course_id=<uuid>` or `?slug=`; both, neither, or any other key is a
     * 400 `invalid_query`, and an unknown course is a 404.
     */
    aboutCourse: `${ROOT}web-api/v1/masterclass/about-course/`,

    /**
     * `IsAuthenticated`, no body. Its response shape is not captured anywhere
     * (Postman's template "could not be resolved"), so the facade re-reads
     * `course-detail/` after it rather than trusting the body.
     */
    bookmark: { path: `${ROOT}web-api/v1/masterclass/bookmark/:id/`, method: 'POST' },

    /**
     * `IsAuthenticated`, no body: the FIRST write of the learning flow. The
     * learner has no enrolment until it runs, and the `mode=` switch is stored
     * on that enrolment. Idempotent. Its guards answer distinctly: `403
     * chapter_locked` / `caira_access_required`, `409` for an AI Lab lock or the
     * 7DC partner flow, and `200 reset_required` for an expired window.
     */
    chapterStart: { path: `${ROOT}web-api/v1/masterclass/chapter-start/:id/`, method: 'POST' },

    /**
     * `IsAuthenticated`, strict body: saves one chapter's progress and answers
     * the whole course's, lock ladder included. `400` "Not enrolled" before a
     * `chapter-start/`; `403 caira_access_required`; `409` for an AI Lab lock;
     * `200 reset_required` for an expired window; a locked or unknown chapter is
     * reported under `skipped`, not refused.
     */
    courseProgressUpdate: {
      path: `${ROOT}web-api/v1/masterclass/course-progress-update/:id/`,
      method: 'POST',
    },

    /**
     * `IsAuthenticated`: one chapter's quiz. Append `<chapter uuid>/`. Its guards,
     * in order: `409` AI Lab lock, `403 caira_access_required`, `403
     * chapter_locked`, `404` with no quiz configured (not an empty 200), `403
     * already_completed`, and `403 preview_mode` (the quiz is CPE only).
     * Unanswered questions carry no answer; a resumed attempt's answered ones
     * come back graded.
     */
    quizQuestions: `${ROOT}web-api/v1/masterclass/quiz-questions/`,

    /**
     * `IsAuthenticated`, strict body `{question_id, selected_option_ids}`: grades
     * ONE answer server-side. The same guards, plus `200 reset_required` for an
     * expired window and `400` for a question outside the bank or one already
     * answered in this attempt.
     */
    quizSubmit: { path: `${ROOT}web-api/v1/masterclass/quiz-submit/:id/`, method: 'POST' },

    urlSegment: 'masterclass',
  },
};

/**
 * Chapters asked for on `course-detail/`, sent as `chapters.page_size`. The API
 * pages them 6 at a time by default; the page lists every chapter, so it asks
 * for the server's cap. The longest UAT masterclass has 11.
 */
export const COURSE_DETAIL_CHAPTERS_PAGE_SIZE = 100;

/**
 * Seconds of playback between progress saves. The legacy player saved at every
 * 5 %, which is 15 s on a 5-minute chapter; it also saves on pause, at the end,
 * on a chapter change and on leaving the page. Closing the tab loses at most
 * this much, because the XHR backend can't keep a request alive past unload.
 */
export const PROGRESS_SAVE_INTERVAL_SECONDS = 15;

/**
 * A playhead move larger than this between two `timeupdate`s is a seek, not
 * play, so it doesn't count as watched. Updates arrive about 4 times a second,
 * so even 2× speed moves well under it.
 */
export const SEEK_JUMP_SECONDS = 3;

/**
 * The chapter player's own copy, used when the server sends no message of its
 * own (`course_pop_up_remark`, or a refusal's `message`).
 */
export const CHAPTER_COPY = {
  courseLocked: { title: 'Course locked', body: 'Subscribe to watch this course.' },
  chapterLocked: {
    title: 'Chapter locked',
    body: 'Finish the previous chapter to unlock this one.',
  },
  chapterNotFound: { title: 'Chapter not found', body: 'That chapter is not part of this course.' },
  quizLocked: {
    title: 'Chapter locked',
    body: "Complete this chapter's quiz to unlock the next one.",
  },
  cannotStart: { title: 'Could not open the chapter', body: 'Please try again in a moment.' },
  progressNotSaved: {
    title: 'Progress not saved',
    body: "We couldn't save your progress. We'll keep trying as you watch.",
  },
  enrolmentReset: {
    title: 'Your enrolment restarted',
    body: 'Your access window had ended, so your progress on this course was reset.',
  },
  modeNotChanged: { title: 'Mode not changed', body: 'Please try again in a moment.' },
  switchToCpe: {
    title: 'Switch to CPE Mode?',
    body: 'You have completed the first chapter in Preview Mode. Switch to CPE Mode to earn your certificate and track your progress with quizzes.',
  },
} as const;

/** The chapter quiz's own copy, used when the server sends no message of its own. */
export const QUIZ_COPY = {
  takeQuiz: 'Take the quiz',
  watchAgain: 'Watch again',
  back: 'Back',
  next: 'Next',
  submit: 'Submit answer',
  proceed: 'Proceed to next chapter',
  backToCourse: 'Back to course',
  correctAnswer: 'Correct answer',
  yourAnswer: 'Your answer',
  explanation: 'Explanation',
  correct: 'Correct',
  incorrect: 'Not quite',
  complete: 'Quiz complete',
  loadFailed: {
    title: 'Quiz unavailable',
    body: "We couldn't load this chapter's quiz. Please try again.",
  },
  answerFailed: {
    title: 'Answer not saved',
    body: "We couldn't save that answer. Please try again.",
  },
  noQuiz: { title: 'No quiz', body: "This chapter doesn't have a quiz." },
} as const;

/** Seconds the finished quiz waits before moving on to the next chapter. */
export const QUIZ_AUTO_ADVANCE_SECONDS = 10;

/**
 * A course id on this API: a UUID, any version. The legacy numeric ids still
 * in old links and search results don't match, and those links are looked up
 * by their slug instead.
 */
export const COURSE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

import { environment } from '@env/environment';
import { CourseDetailApi, CourseOffering } from '@features/offerings/models/course-detail.model';
import { AssessmentReviewStatus } from '@features/offerings/models/final-assessment.model';

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

    /**
     * `IsAuthenticated`, no body: draws the final assessment's sitting (`201`),
     * or returns the open one (`200`, `resumed: true`), so a second start never
     * redraws. Refusals, in order: `409` AI Lab lock, `403 caira_access_required`,
     * `403 preview_mode`, `404` no configuration, `403 chapters_not_complete`,
     * `403 already_passed`, `403 cool_off_active` (with `cool_off_ends_at`), and
     * `404` for a bank with no active question.
     */
    assessmentStart: {
      path: `${ROOT}web-api/v1/masterclass/assessment-start/:id/`,
      method: 'POST',
    },

    /**
     * `IsAuthenticated`: a sitting's paper again, the same questions in the same
     * order, and never their answers. Append `<course uuid>/` and send
     * `?session_id=`. A sitting that is gone answers `404 session_not_found`, `409
     * session_submitted` or `409 session_expired`.
     */
    assessmentQuestions: `${ROOT}web-api/v1/masterclass/assessment-questions/`,

    /**
     * `IsAuthenticated`, strict body `{session_id, answers}` answering exactly the
     * sitting's questions: scores it server-side and closes the sitting. `200`
     * with `passed` and `score_percent`, or `reset_required` for an expired
     * window; the start's refusals, plus `409 session_submitted` / `expired`.
     */
    assessmentSubmit: {
      path: `${ROOT}web-api/v1/masterclass/assessment-submit/:id/`,
      method: 'POST',
    },

    /**
     * `IsAuthenticated`: the learner's final assessment for one course. Append
     * `<course uuid>/`. ALWAYS answers (`passed`, `failed` or `not_attempted`);
     * the only 404 is an unknown course. Its `answers[]` is empty in every
     * captured example, so the review reads `assessmentResult` instead.
     */
    assessmentReport: `${ROOT}web-api/v1/masterclass/assessment-report/`,

    /**
     * `IsAuthenticated`: the latest attempt, question by question. Append
     * `<course uuid>/`. `404` for an unknown course, no configuration or no
     * attempt yet; `403 caira_access_required`; `409` AI Lab lock. Correct
     * answers are withheld on a failed attempt against a bank-less assessment
     * (NASBA 6.01.2(1)(ii)), which the report flags as `feedback_withheld`.
     */
    assessmentResult: `${ROOT}web-api/v1/masterclass/assessment-result/`,

    /**
     * `IsAuthenticated`: the post-course evaluation. Append `<course uuid>/`.
     * Gated on a pass: `403 assessment_not_passed` before one, `403
     * feedback_already_submitted` after the form is in, `403
     * caira_access_required`, `409` AI Lab lock, and `200 reset_required` for an
     * expired window.
     */
    feedbackQuestions: `${ROOT}web-api/v1/masterclass/feedback-questions/`,

    /**
     * `IsAuthenticated`, strict body `{responses, optional_feedback_text}`:
     * records the evaluation once (never edited) and runs the course closure
     * (CPE, Credly badge, certificate). The questions read's refusals, plus `400`.
     */
    feedbackSubmit: {
      path: `${ROOT}web-api/v1/masterclass/feedback-submit/:id/`,
      method: 'POST',
    },

    /**
     * `IsAuthenticated`, `?course_id=<uuid>`: the learner's own evaluation.
     * Always answers (`submitted: false` before one). Its paged `responses` are
     * empty in every capture, so only the submission's date is read.
     */
    feedbackResponses: `${ROOT}web-api/v1/masterclass/feedback-responses/`,

    /**
     * `IsAuthenticated`: the GET twin of `courseProgressUpdate`. Append `<course
     * uuid>/`. Its top level carries the same completion flags as
     * `course-detail/`, `masterclass_certificate_url` included, in a lighter
     * read, so the wait for a freshly triggered certificate asks this one.
     */
    courseProgress: `${ROOT}web-api/v1/masterclass/course-progress/`,

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
 * The final assessment's dialogs' panel width: the same as `UtilsDialog`'s navy
 * box (`md:max-w-[500px]`). The default panel is `max-w-lg` (512px), which left
 * a 6px strip of the panel showing either side of the box.
 */
export const ASSESSMENT_DIALOG_WIDTH = '500px';

/**
 * The paper read's and the submit's refusals that mean the sitting itself is
 * over (submitted, aged out, or not this learner's): only a new start helps.
 */
export const ASSESSMENT_ENDED_SITTING: readonly string[] = [
  'session_not_found',
  'session_submitted',
  'session_expired',
];

/** The final assessment's own copy, used when the server sends no message of its own. */
export const ASSESSMENT_COPY = {
  take: 'Take Final Assessment',
  rulesTitle: 'Final Assessment',
  rulesIntro: 'QAS Self-Study Qualified Assessment Rules:',
  startExam: 'Start Exam',
  loading: 'Loading assessment...',
  passed: (score: number) =>
    `You have successfully passed the assessment with a score of ${score}%.`,
  failed: (score: number, passMark: number) =>
    `You scored ${score}%. Don't give up! Review the material and try again to achieve the passing score of ${passMark}%.`,
  incomplete: {
    title: 'Assessment Incomplete',
    body: 'Please answer the following questions before submitting:',
  },
  exit: {
    title: 'Exit Assessment?',
    body: 'Are you sure you want to leave the assessment? Your answers will be lost if you leave without submitting.',
  },
  notReady: { title: 'Not available yet', body: 'Finish every chapter and its quiz first.' },
  alreadyPassed: { title: 'Already passed', body: "You've already passed this assessment." },
  coolOff: {
    title: 'Retake not open yet',
    body: 'You can retake the assessment a little later.',
    until: (time: string) => `You can retake the assessment after ${time}.`,
  },
  previewMode: {
    title: 'CPE Mode only',
    body: 'Switch to CPE Mode to take the final assessment.',
  },
  noAssessment: { title: 'No final assessment', body: 'This course has no final assessment yet.' },
  cannotStart: { title: 'Could not start the assessment', body: 'Please try again in a moment.' },
  submitFailed: {
    title: 'Assessment not submitted',
    body: "We couldn't submit your answers. Please try again.",
  },
  sittingEnded: {
    title: 'This sitting has ended',
    body: 'Start the assessment again to get a new set of questions.',
  },
  loadFailed: {
    title: "Couldn't load the assessment",
    body: 'Please try again in a moment.',
  },
} as const;

/** The assessment report's own copy, used when the server sends no message of its own. */
export const ASSESSMENT_REPORT_COPY = {
  title: 'Exam Report',
  loading: 'Loading report...',
  backToCourse: 'Back to Course',
  viewReport: 'View Report',
  retake: 'Retake Assessment',
  passed: 'Passed',
  failed: 'Not passed',
  score: 'Score',
  correctAnswers: 'Correct answers',
  skipped: 'Skipped',
  passMark: 'Pass mark',
  completedOn: 'Completed on',
  attempts: 'Attempts',
  questions: 'Exam Questions',
  wrongOnly: 'Show wrong answers only',
  noneWrong: 'Every answer was correct.',
  correct: 'Correct',
  incorrect: 'Incorrect',
  skippedBadge: 'Skipped',
  yourAnswer: 'Your answer',
  notAnswered: 'Not answered',
  correctAnswer: 'Correct answer',
  explanation: 'Explanation',
  withheld:
    "Correct answers aren't shown for a failed attempt on this course. Review the material and try again.",
  notAttempted: {
    title: 'No attempt yet',
    body: "You haven't taken the final assessment for this course.",
  },
  loadFailed: { title: "Couldn't load the report", body: 'Please try again in a moment.' },
  reviewFailed: { title: "Couldn't load the questions", body: 'Please try again in a moment.' },
} as const;

/** The course evaluation's own copy, used when the server sends no message of its own. */
export const FEEDBACK_COPY = {
  submitFeedback: 'Submit Feedback',
  feedbackSubmitted: 'Feedback Submitted',
  title: 'Course Evaluation Feedback',
  name: 'Name-',
  formTitle: 'Course Evaluation Form',
  formIntro:
    'Thank you for participating in this self study course. Please take a moment to offer your feedback. Please rank each item below, with 1 being the lowest and 5 being the highest score.',
  ratingsHeading: '1. Presenters and Course Content',
  scale: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
  commentsHeading: '2. Other Comments',
  commentsPlaceholder: 'Type here',
  submit: 'Submit',
  submitting: 'Submitting...',
  loading: 'Loading feedback form...',
  thanks: { title: 'Thank You!', body: 'Your feedback has been submitted successfully.' },
  cpeAwarded: (credits: number) => `${credits} CPE credits have been awarded for this course.`,
  submitted: {
    title: 'Thanks, your feedback is in',
    body: 'You have already submitted feedback for this course.',
    on: 'Submitted on',
  },
  notPassed: {
    title: 'Pass the final assessment first',
    body: 'Course feedback opens once you have passed the final assessment.',
  },
  continue: 'Continue',
  loadFailed: { title: "Couldn't load the feedback form", body: 'Please try again in a moment.' },
  submitFailed: {
    title: 'Feedback not submitted',
    body: "We couldn't submit your feedback. Please try again.",
  },
  profile: {
    title: 'Complete Your Profile to Continue',
    body: 'Before submitting feedback, please finish setting up your profile. We use it to issue your CPE certificate and personalise your learning path.',
    button: 'Complete Profile',
  },
} as const;

/** The certificate's own copy. */
export const CERTIFICATE_COPY = {
  download: 'Download Certificate',
  preparing: 'Preparing Certificate...',
  notReady: {
    title: 'Certificate on its way',
    body: 'Your certificate is being generated. Please try again in a minute.',
  },
} as const;

/**
 * The feedback triggers the certificate; the server generates the PDF on its
 * own time and only then sends its link. The page asks again this often, this
 * many times (2 minutes), before it stops and lets a click ask again.
 */
export const CERTIFICATE_POLL_SECONDS = 5;
export const CERTIFICATE_POLL_ATTEMPTS = 24;

/** Each reviewed question's badge, and the colour its answer takes. */
export const ASSESSMENT_REVIEW_STATUS: Record<
  AssessmentReviewStatus,
  { label: string; badge: string; answer: string }
> = {
  correct: {
    label: ASSESSMENT_REPORT_COPY.correct,
    badge: 'bg-success/15 text-success',
    answer: 'text-success',
  },
  incorrect: {
    label: ASSESSMENT_REPORT_COPY.incorrect,
    badge: 'bg-destructive/15 text-destructive',
    answer: 'text-destructive',
  },
  skipped: {
    label: ASSESSMENT_REPORT_COPY.skippedBadge,
    badge: 'bg-muted text-muted-foreground',
    answer: 'text-muted-foreground',
  },
};

/**
 * A course id on this API: a UUID, any version. The legacy numeric ids still
 * in old links and search results don't match, and those links are looked up
 * by their slug instead.
 */
export const COURSE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

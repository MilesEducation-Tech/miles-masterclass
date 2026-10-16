/**
 * What the reel page's chapter-quiz entry points say while the quiz is unbound.
 * The quiz they opened read `chapter-quiz` and answered on `user-quiz-details/`,
 * both of which answer 404; the web API's `quiz-questions` / `quiz-submit`
 * replace them.
 */
export const CHAPTER_QUIZ_UNAVAILABLE = {
  title: 'Quiz',
  body: "The chapter quiz isn't available yet.",
} as const;

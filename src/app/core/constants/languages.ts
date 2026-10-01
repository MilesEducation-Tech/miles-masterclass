/**
 * Every language the app knows (ISO 639-1). Which of them a build may actually resolve to is
 * `environment.I18N.languages`: a language is listed there only once it is translated, so this list
 * can run ahead of the translations without reaching real users.
 *
 * The language is independent of the country: any language can be used in any country.
 */
export const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'] as const;

/**
 * Each language's name IN ITSELF, for the switcher. Never translated: someone who landed in a
 * language they can't read must still be able to find their own.
 */
export const LANGUAGE_NAMES = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
} as const satisfies Record<(typeof SUPPORTED_LANGUAGES)[number], string>;

/** Every visitor without a usable cookie or browser preference, and every crawler. */
export const DEFAULT_LANGUAGE = 'en';

/** Languages written right to left: the page gets `<html dir="rtl">`. */
export const RTL_LANGUAGES: readonly string[] = ['ar'];

/**
 * The visitor's explicit choice. Written ONLY by the language switcher, never as a side effect of
 * detection: an auto-saved guess would outrank the browser's real preference forever.
 */
export const LANGUAGE_COOKIE = 'lang';

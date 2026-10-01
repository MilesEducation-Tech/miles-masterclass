import type { SUPPORTED_LANGUAGES } from '../constants/languages';

/** A language the app knows (ISO 639-1). Validate untrusted input with `toLanguage()`. */
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Value of `<html dir>`. */
export type TextDirection = 'ltr' | 'rtl';

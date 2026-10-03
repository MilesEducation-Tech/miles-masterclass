import { PROFESSIONS } from '../constants/profession';
import type { SUPPORTED_COUNTRIES } from '../constants/countries';

export type ProfessionType = (typeof PROFESSIONS)[number];

/** A supported country (lower-case ISO2). Validate untrusted input with `toCountry()`. */
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

export interface DynamicRouteParams {
  country: CountryCode;
  profession: ProfessionType;
}

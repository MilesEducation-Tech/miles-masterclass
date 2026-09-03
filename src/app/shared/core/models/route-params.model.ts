import { PROFESSIONS } from '../constant/profession';
import { locationJson } from '../constant/location';

export type ProfessionType = (typeof PROFESSIONS)[number];

// Extracting ISO2 codes from locationJson for strict typing if needed,
// otherwise just alias to string for now since locationJson is large and might be inferred as general object array
export type CountryCode = string;

export interface DynamicRouteParams {
  country: CountryCode;
  profession: ProfessionType;
}

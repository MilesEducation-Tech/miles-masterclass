import { RouteConfig } from './http.model';

/**
 * Backend-facing course type as it appears in the suggestion response's
 * `type` field. Maps to URL segments via `SEARCH_TYPE_TO_URL_SEGMENT`.
 */
export type SearchCourseType =
  'masterclass' | 'podcast' | 'micro_learning' | 'nano_learning' | 'webinar';

export type SearchUrlSegment = 'masterclass' | 'podcast' | 'micro-learning' | 'webinar';

export const SEARCH_TYPE_TO_URL_SEGMENT: Record<SearchCourseType, SearchUrlSegment> = {
  masterclass: 'masterclass',
  podcast: 'podcast',
  micro_learning: 'micro-learning',
  nano_learning: 'micro-learning',
  webinar: 'webinar',
};

export interface SearchSuggestionInstructor {
  id: number;
  first_name: string;
  last_name: string;
}

export interface SearchSuggestionFieldOfStudy {
  id: number;
  name: string;
  cpe_credits: number;
}

export interface SearchSuggestion {
  id: number;
  title: string;
  type: SearchCourseType;
  course_type: string;
  thumbnail: string;
  horizontal_thumbnail: string;
  class_credits: number;
  fields_of_study: SearchSuggestionFieldOfStudy[];
  instructors: SearchSuggestionInstructor[];
  podcast_format?: string | null;
}

export interface SearchSuggestionPagination {
  total_count: number;
  current_page_number: number;
  next_page: string | null;
  previous_page: string | null;
}

export interface SearchSuggestionResponse {
  status_code: number;
  message: string;
  data: SearchSuggestion[];
  pagination_data: SearchSuggestionPagination;
}

export const SEARCH_ROUTES = {
  suggestion: {
    path: 'v2/dashboard/suggestion/',
    method: 'GET',
  } as RouteConfig<
    void,
    SearchSuggestionResponse,
    {},
    {
      search_key: string;
      page?: number;
    }
  >,
} as const;
